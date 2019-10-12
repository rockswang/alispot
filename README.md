# [支持作者，从这里购买阿里云！](https://promotion.aliyun.com/ntms/yunparter/invite.html?userCode=u2h4dcnl)

# 概述
目前阿里云海外节点的抢占式实例性价比相当高，服务器使用费用平均在0.01\~0.02元/小时，外加流量费0.5\~1.0元/G，特别适合上班族尤其是程序员日常使用。<br/>
独立服务器，专享带宽，乞丐价格，帝皇体验！<br/>
上班来了一键翻墙，下班了自动释放，绝不浪费，超级巴适！<br/>
精打细算，随用随开，不用不花钱。不看太多视频的话，一天的成本可以控制在**2毛钱以内**！<br/>
通过启动GoogleBBR加速，经speedtest.net实测，上下行速度均可以跑满创建实例时设定的带宽上限！
![测速](https://user-images.githubusercontent.com/2248386/65750274-91ae9000-e13a-11e9-87e8-90b912aaaf3d.png)

# 本脚本实现的功能
1. 在指定的阿里云地域上自动创建阿里云抢占式实例
1. 启用GoogleBBR网络加速，这需要升级操作系统内核然后重启
1. 自动部署并启动SSR服务器
1. 启动一个本地端口映射服务，将本地端口映射到SSR服务的同名端口上

注意，本人仅在Windows10 x64上测试过，其它平台未测试。

# 开箱即用方式启动
1. 请去release中下载alispot.exe
1. 把EXE下载到本地后，在同目录下创建config.json，内容见下面“配置”一节
1. 双击alispot.exe启动，这会打开一个命令行窗口，等待几分钟即可。窗口中最后会显示连接信息
1. 第二天重新启动之前，不要忘了把头天的窗口关掉，否则会导致本地端口占用冲突

注：
1. 即使是开箱即用方式，也得先把下一节“前提”中的准备工作做好
1. 目前只打包了windows x86的可执行文件（兼容x64），其它平台请参见“构建”和“启动”

# 前提
* 在阿里云注册一个账号
* 在阿里云**充值至少120元**人民币。这是因为阿里云要求账户余额必须在100以上才能创建抢占式实例。剩下20元用来日常消费，只要不经常看视频应该够用很长时间了。**短期使用也不用担心，通过支付宝/网银的充值，可在支付后的3个月内申请原路提现。**
* 在阿里云控制台"访问控制"里面，添加一个RAM子用户，此账户专门用来支持API调用。
* 给该RAM用户**添加AliyunECSFullAccess和AliyunVPCFullAccess权限**。因为脚本需要创建虚拟专网和ECS服务器。
* 给该RAM用户创建一个AccessKey，然后把AccessKey ID和AccessKey Secret记住。
  注意：为了安全起见，阿里云不会保存Secret，因此**Secret只会显示一次，一定马上复制保存好！！** 否则就得创建个新的AccessKey。
* 本脚本不包含SSR客户端，请自行安装，推荐C#版本。注意：客户端的配置和config.json中ssr_server配置段的端口、密码、加密、协议、混淆必须一一对应。

 ![访问控制](https://user-images.githubusercontent.com/2248386/65750277-92472680-e13a-11e9-8070-78f3c5d056dd.png)<center>访问控制</center>

  ![RAM用户1](https://user-images.githubusercontent.com/2248386/65750270-9115f980-e13a-11e9-89b1-b2db34c9f688.png)<center>创建RAM用户1</center>

  ![RAM用户2](https://user-images.githubusercontent.com/2248386/65750271-91ae9000-e13a-11e9-9e0b-d32aebfa43ce.png)<center>创建RAM用户2</center>

  ![RAM权限1](https://user-images.githubusercontent.com/2248386/65750268-907d6300-e13a-11e9-854b-5f3d75f3b7f2.jpg)<center>添加RAM权限1</center>

  ![RAM权限2](https://user-images.githubusercontent.com/2248386/65750269-9115f980-e13a-11e9-91f7-55d3a939483e.jpg)<center>添加RAM权限1</center>

  ![RAM用户3](https://user-images.githubusercontent.com/2248386/65750273-91ae9000-e13a-11e9-98aa-761345764b0b.png)<center>获取AccessKeyID和AccessKeySecret</center>


# 阿里云抢占式实例和流量计费规则
* 抢占式实例有一个较高的原价和较低的市场价，创建前还可以设定出价，出价比市场价高才能创建成功，但是计费**总是按照市场价**的。
* 目前这个脚本使用自动出价，这样理论是可以100%创建成功的。
* 如果不设定自动释放时间，1小时后实例会被自动释放。
* 不满1小时按实际使用分钟数计费，不到1分钱则免费，不用担心阿里云蚕食你的费用。
* 抢占式实例每小时结算一次，结算最小单位是分，不满1分的部分则抹零。
* 本脚本创建的实例按实际使用流量计费，这个费用不同区域不同。目前大部分海外区域是1元/G以内，比如新加坡是0.53元/G。
* 阿里云仅对流出流量计费，因此不用担心代理流量被“双向收费”。
* 流量也是每小时结算一次，不到1分钱则免费，因此要是一小时内浏览网页仅产生10几M流量的话，就免单了。

# 脚本说明
* 脚本会SSH连上服务器，并下载执行本项目中的bbr.sh脚本来启用GoogleBBR。关于BBR的原理和脚本介绍，请见参考。
* bbr.sh会升级CentOS系统内核，启用BBR，并重启服务器。
* SSR服务端为python版，脚本会用git从github的shadowsocksr-backup仓库中克隆，并自动后台运行。
* 如果因为未知原因脚本执行中断或失败，可以再次运行。但别忘了自行登录阿里云后台释放掉未成功的实例，省1毛是一毛。

# 构建
* 把项目克隆到本地
* 执行 `npm install`

# 配置
* 如下修改配置文件 config.json
* 在RAM配置段，把前面保存的AccessKeyID和AccessKeySecret填入。
* 在ECS配置段，在地域即RegionId中填入目标地域ID。这个取决于从你本地连接的速度和价格，个人推荐新加坡，从我这里Ping值大约80ms，性价比最高。
* 推荐设置一个自动释放时间AutoReleaseTime，否则1小时后服务器可能会被自动回收。
* 带宽上限InternetMaxBandwidthOut预设值是10(M)，你可以根据需求调整。
* ECS的其它配置保持默认即可。具体参见后面的详解。

### 阿里云海外节点地域对应表: 
RegionId | 地域名称
--- | ---
cn-hongkong | 香港 
ap-northeast-1 | 亚太东北 1 (东京) 
ap-southeast-1 | 亚太东南 1 (新加坡) 
ap-southeast-2 | 亚太东南 2 (悉尼) 
ap-southeast-3 | 亚太东南 3 (吉隆坡) 
ap-southeast-5 | 亚太东南 5 (雅加达) 
ap-south-1 | 亚太南部 1 (孟买) 
us-east-1 | 美国东部 1 (弗吉尼亚) 
us-west-1 | 美国西部 1 (硅谷) 
eu-west-1 | 英国 (伦敦) 
me-east-1 | 中东东部 1 (迪拜) 
eu-central-1 | 欧洲中部 1 (法兰克福) 
### ECS配置项详解
配置项 | 说明
--- | ---
RegionId | 服务器目标地域ID，对应关系见上表
AutoReleaseTime | 自动释放时间，HH:mm:ss格式，或YYYY-MM-DD HH:mm:ss格式，如果比当前时间早，则自动顺延一天。<br/>也可以不设定自动释放时间，这种情况下请自行登录阿里云后台设置释放时间
Password | 操作系统root账户的密码，默认不设定，则随机生成密码。生成的密码可以在后台打印信息中找到
ImageId | 操作系统镜像ID，默认使用CentOS 7.6，不建议修改
InstanceType | 实例类型，默认使用最便宜的1核1G主机，不建议修改
InternetMaxBandwidthOut | 出网流量带宽上限，单位M；默认10，想要嗨起来的可以增加
InternetChargeType | 流量计费类型，默认按实际使用流量，不建议修改
SystemDisk.Size | 系统盘大小，单位G；默认最小值20G，足够用了
SystemDisk.Category | 系统盘类型，不建议修改
SpotStrategy | 抢占式实例出价类型，默认按市场价，不建议修改

# 启动
* 执行 `npm start`，然后等待即可。
* 命令是按照windows配置的，linux/mac上可以这样手动执行脚本：<br/>
  `node index.js | ./node_modules/.bin/bunyan`<br/>
   bunyan是日志过滤工具，不用也可以
* 整个脚本运行大概需要3 ~ 5分钟，最后会打印出SSR连接信息，照此修改客户端配置即可，通常就是改个IP。
* 脚本最后会使用forward.js创建一个端口转发，这样SSR客户端只要把服务端IP设成localhost即可，连上一步说的IP都不用改了。
* 如果使用本地端口转发，最后不要把命令窗口关闭，否则程序就停了。

# 参考
* [阿里云 OpenAPI Explorer](https://api.aliyun.com/#/)
* [ssr_py版的命令行参考](https://doubibackup.com/hi10k-7p-4.html)
* [Google BBR是什么？以及在 CentOS 7 上如何部署](https://www.codercto.com/a/25431.html) - 本项目中的版本为了自动化去掉了原shell脚本的用户交互部分
* [forward.js](https://github.com/sjitech/forward.js) - nodejs端口转发工具，因为这不是个node模块，因此直接引用源代码
* [加入作者的QQ群](https://jq.qq.com/?_wv=1027&k=5osCydC) - JavaScript开发者的小圈子
* [立即开通阿里云！](https://promotion.aliyun.com/ntms/yunparter/invite.html?userCode=u2h4dcnl)
