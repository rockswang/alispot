const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const Core = require('@alicloud/pop-core')
const dayjs = require('dayjs')
const bunyan = require('bunyan')
const ssh = require('ssh2')

const { forwardjs } = require('./forward')

const log = bunyan.createLogger({
  name: 'alispot',
  streams: [{
    level: 'info',
    stream: process.stdout
  }, {
    level: 'debug',
    path: path.join(__dirname, 'alispot.log')
  }]
})

const options = { method: 'POST', timeout: 20000 }

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function _sshConnect (params) {
  return new Promise((resolve, reject) => {
    const conn = new ssh.Client()
    conn.on('ready', () => {
      resolve(conn)
    }).on('error', err => {
      reject(err)
    }).connect(params)
  })
}

async function sshConnect (params) {
  for (let retryCount = 0; ; retryCount++) {
    try {
      return await _sshConnect(params)
    } catch (err) {
      if (retryCount >= 3) throw err
      log.warn(`SSH连接失败，重试第${retryCount + 1}次...`)
      await sleep(500)
    }
  }
}

function sshExec (conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) {
        reject(err)
      } else {
        let out = ''
        stream.on('close', (code, signal) => {
          out += `CLOSE: code=${code}, signal=${signal}`
          log.debug(`CLOSE: code=${code}, signal=${signal}`)
          resolve(out)
        }).on('data', data => {
          out += `STDOUT: ${data}\n`
          log.debug(`STDOUT: ${data}`)
        }).stderr.on('data', data => {
          out += `STDERR: ${data}\n`
          log.debug(`STDERR: ${data}`)
        })
      }
    })
  })
}

async function statusCheck (client, api, params, beforeStart, interval, times, check) {
  if (beforeStart > 0) await sleep(beforeStart)
  let retryCount = 0
  while (retryCount < times) {
    const result = await client.request(api, params, options)
    if (check(result)) return result
    await sleep(interval)
    retryCount++
  }
  if (retryCount >= times) throw new Error('statusCheck timeout: ' + api)
}

async function main () {
  try {
    const confPath = process.argv[2] || path.join(__dirname, 'config.json')
    const config = JSON.parse(fs.readFileSync(confPath, 'utf8'))
    const { RAM, ECS } = config
    const client = new Core({
      accessKeyId: RAM.accessKeyId,
      accessKeySecret: RAM.accessKeySecret,
      apiVersion: '2014-05-26',
      endpoint: 'https://ecs.aliyuncs.com'
    })

    let result = await client.request('DescribeRegions', {}, options)
    log.debug({ result }, 'DescribeRegions')
    client.endpoint = 'https://' + result.Regions.Region.find(o => o.RegionId === ECS.RegionId).RegionEndpoint
    log.info('地域"%s"的API地址："%s"', ECS.RegionId, client.endpoint)

    let params = {
      RegionId: ECS.RegionId,
      NetworkType: 'vpc',
      InstanceType: ECS.InstanceType
    }
    result = await client.request('DescribeSpotPriceHistory', params, options)
    log.debug({ result }, 'DescribeSpotPriceHistory')
    const ZoneId = result.SpotPrices.SpotPriceType.sort((p1, p2) => p1.SpotPrice - p2.SpotPrice)[0].ZoneId
    log.info('地域"%s"抢占式实例价格最低的可用区："%s"', ECS.RegionId, ZoneId)

    params = {
      RegionId: ECS.RegionId,
      SecurityGroupName: 'alispotCreatedSecurityGroup'
    }
    let VpcId, SecurityGroupId
    result = await client.request('DescribeSecurityGroups', params, options)
    log.debug({ result }, 'DescribeSecurityGroups')
    if (result.TotalCount === 0) {
      log.info('创建VPC和安全组', ECS.RegionId)
      params = {
        RegionId: ECS.RegionId,
        CidrBlock: '172.16.0.0/24',
        VpcName: 'alispotCreatedVpc'
      }
      result = await client.request('CreateVpc', params, options)
      log.debug({ result }, 'CreateVpc')
      VpcId = result.VpcId

      log.info('Vpc已创建，等待Vpc启用...')
      params = { RegionId: ECS.RegionId, VpcId }
      const start = Date.now()
      result = await statusCheck(client, 'DescribeVpcs', params, 2000, 2000, 5, r => r.Vpcs.Vpc[0].Status === 'Available')
      log.debug({ result }, 'DescribeVpcs')
      log.info('Vpc已创建，耗时约%s ms', (Date.now() - start))

      params = {
        RegionId: ECS.RegionId,
        VpcId,
        SecurityGroupName: 'alispotCreatedSecurityGroup'
      }
      result = await client.request('CreateSecurityGroup', params, options)
      log.debug({ result }, 'CreateSecurityGroup')
      SecurityGroupId = result.SecurityGroupId
    } else {
      SecurityGroupId = result.SecurityGroups.SecurityGroup[0].SecurityGroupId
      VpcId = result.SecurityGroups.SecurityGroup[0].VpcId
    }
    log.info(`VpcId: ${VpcId}, SecurityGroupId: ${SecurityGroupId}`)
    params = {
      RegionId: ECS.RegionId,
      SecurityGroupId,
      IpProtocol: 'tcp',
      SourceCidrIp: '0.0.0.0/0'
    }
    const port = config.ssr_server.port + ''
    const PortRange = port.slice(0, -1) + '0/' + port.slice(0, -1) + '9'
    result = await Promise.all([
      client.request('AuthorizeSecurityGroup', { ...params, IpProtocol: 'icmp', PortRange: '-1/-1' }, options), // enable ping
      client.request('AuthorizeSecurityGroup', { ...params, PortRange: '22/22' }, options),
      client.request('AuthorizeSecurityGroup', { ...params, PortRange: '80/80' }, options),
      client.request('AuthorizeSecurityGroup', { ...params, PortRange: '443/443' }, options),
      client.request('AuthorizeSecurityGroup', { ...params, PortRange }, options)
    ])
    log.debug({ result }, 'AuthorizeSecurityGroup')
    log.info(`为安全组${SecurityGroupId}开启端口`)

    let VSwitchId
    params = { RegionId: ECS.RegionId, VpcId, ZoneId }
    result = await client.request('DescribeVSwitches', params, options)
    log.debug({ result }, 'DescribeVSwitches')
    if (result.TotalCount === 0) {
      log.info('创建VSwitch', ECS.RegionId)
      params = {
        RegionId: ECS.RegionId,
        CidrBlock: '172.16.0.0/24',
        VpcId,
        ZoneId,
        VSwitchName: 'alispotCreatedVSwitch'
      }
      result = await client.request('CreateVSwitch', params, options)
      log.debug({ result }, 'CreateVSwitch')
      VSwitchId = result.VSwitchId

      const start = Date.now()
      params = { RegionId: ECS.RegionId, VpcId, ZoneId, VSwitchId }
      result = await statusCheck(client, 'DescribeVSwitches', params, 500, 1000, 3, r => r.VSwitches.VSwitch[0].Status === 'Available')
      log.debug({ result }, 'DescribeVSwitches')
      log.info('VSwitch已创建，耗时约%s ms', (Date.now() - start))
    } else {
      VSwitchId = result.VSwitches.VSwitch[0].VSwitchId
    }
    log.info(`VSwitchId: ${VSwitchId}`)

    let { AutoReleaseTime, Password } = ECS
    if (AutoReleaseTime && /\d{2}:\d{2}:\d{2}/.test(AutoReleaseTime)) {
      const localTime = dayjs().format('YYYY-MM-DD') + ' ' + AutoReleaseTime
      const isoTime = dayjs(localTime).toISOString()
      AutoReleaseTime = isoTime.replace(/\.\d{3}Z$/, 'Z')
    }
    Password = Password || ('AliSpot@' + crypto.createHash('MD5').update('alispot' + Date.now()).digest('hex').substr(0, 13))
    params = {
      ...ECS,
      ZoneId,
      SecurityGroupId,
      VSwitchId,
      AutoReleaseTime,
      Password
    }
    result = await client.request('RunInstances', params, options)
    log.debug({ result }, 'RunInstances')
    const InstanceId = result.InstanceIdSets.InstanceIdSet[0]
    log.info('抢占式实例已经创建，实例ID: %s，等待实例启动...', InstanceId)

    params = {
      RegionId: ECS.RegionId,
      InstanceIds: JSON.stringify([InstanceId])
    }
    let start = Date.now()
    result = await statusCheck(client, 'DescribeInstances', params, 10000, 5000, 20, r => r.Instances.Instance[0].Status === 'Running')
    log.debug({ result }, 'DescribeInstances')
    log.info('实例已启动，耗时约%s ms', (Date.now() - start))
    const IpAddress = result.Instances.Instance[0].PublicIpAddress.IpAddress[0]
    log.info('实例SSH连接信息: IP：%s, 端口: 22, 账户: root, 密码: %s', IpAddress, Password)
    log.info('SSH连接中...')

    const sshParams = {
      host: IpAddress,
      port: 22,
      username: 'root',
      password: Password
    }
    let conn = await sshConnect(sshParams)
    log.info('SSH已连接；开始启用GoogleBBR...')
    await sshExec(conn, 'wget --no-check-certificate https://github.com/rockswang/alispot/raw/master/bbr.sh && chmod +x bbr.sh && ./bbr.sh')
    try { conn.end() } catch (err) { }
    log.info('GoogleBBR已启用；系统重启...')

    start = Date.now()
    result = await statusCheck(client, 'DescribeInstances', params, 10000, 5000, 20, r => r.Instances.Instance[0].Status === 'Running')
    log.debug({ result }, 'DescribeInstances')
    log.info('实例已重启，耗时约%s ms', (Date.now() - start))

    conn = await sshConnect(sshParams)
    log.info('SSH已重新连接；开始安装SSR Server...')
    await sshExec(conn, 'yum install git -y')
    await sshExec(conn, 'git clone -b manyuser https://github.com/shadowsocksr-backup/shadowsocksr.git')
    const ssr = config.ssr_server
    let args = `-p ${ssr.port} -k '${ssr.password}' -m '${ssr.method}' -O '${ssr.protocol}' -o '${ssr.obfs}'`
    if (ssr.protocol_param) args += ` -G '${ssr.protocol_param}'`
    if (ssr.obfs_param) args += ` -g '${ssr.obfs_param}'`
    await sshExec(conn, `nohup python shadowsocksr/shadowsocks/server.py ${args} >> /dev/null 2>&1 &`)
    try { conn.end() } catch (err) { }
    log.info('SSR服务端已启动')
    log.info('SSR客户端配置信息：')
    log.info('  服务器IP: %s', IpAddress)
    log.info('  服务器端口: %s', ssr.port)
    log.info('  密码: %s', ssr.password)
    log.info('  加密: %s', ssr.method)
    log.info('  协议: %s', ssr.protocol)
    log.info('  协议参数：%s', ssr.protocol_param || '无')
    log.info('  混淆: %s', ssr.obfs)
    log.info('  混淆参数: %s', ssr.obfs_param || '无')

    log.info('启动本地端口转发，正在监听%s...', ssr.port)
    forwardjs(['' + ssr.port, `${IpAddress}:${ssr.port}`])
  } catch (error) {
    log.fatal(error)
  }
}

main()
