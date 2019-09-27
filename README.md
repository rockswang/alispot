# [支持作者，从这里购买阿里云！](https://promotion.aliyun.com/ntms/yunparter/invite.html?userCode=u2h4dcnl)

# 概述
目前阿里云海外节点的抢占式实例性价比相当高，服务器使用费用平均在0.01\~0.02元/小时，外加流量费0.5\~1.0元/G，特别适合上班族尤其是程序员日常使用。<br/>
上班来了启动脚本，下班了自动释放，一点不浪费，不看太多视频的话，一天的成本可以控制在2毛钱以内。<br/>
通过启动GoogleBBR加速，经speedtest.net实测，上下行速度均可以跑满创建实例时设定的带宽上限。

本脚本实现的功能：
1. 在指定的阿里云地域上自动创建阿里云抢占式实例
1. 启用GoogleBBR网络加速，这需要升级操作系统内核然后重启

注意，本人仅在Windows10 x64上测试过，其它平台未测试。

# 前提
* 在阿里云有个账号
* 充值至少120块钱人民币。这是因为阿里云要求账户余额必须在100以上才能创建抢占式实例。剩下20用来日常消费，只要不经常看视频应该够用挺长时间了。不要担心100元打水漂，通过支付宝/网银的充值，可在支付后的3个月内申请原路提现。
* 在阿里云控制台"访问控制"里面，添加一个RAM子用户，此账户专门用来支持API调用。
* 给该RAM用户添加AliyunECSFullAccess和AliyunVPCFullAccess权限。因为脚本需要创建虚拟专网和ECS服务器。
* 给该RAM用户创建一个AccessKey，然后把AccessKey ID和AccessKey Secret记住。注意：为了安全起见，阿里云不会保存Secret，因此Secret只会显示一次，一定马上复制保存好！！否则就得创建个新的AccessKey。
* 本地安装了node.js。我只在node12上测试过，但估计node8以上都应该没问题。

# 脚本说明
* 脚本会SSH连上服务器，并下载执行本项目中的bbr.sh脚本来启用GoogleBBR。关于BBR的原理和脚本介绍，请见参考。
* GoogleBBR会升级CentOS操作系统内核，并重启服务器。

# 安装
* 把项目克隆到本地
* 执行 `npm install`

# 配置
* 如下修改配置文件 config.json
* 在RAM配置段，把前面保存的AccessKeyID和AccessKeySecret填入。
* 在ECS配置段，在地域即RegionId中填入目标地域ID。这个取决于从你本地连接的速度和价格，个人推荐新加坡`ap-southeast-1`，从我这里Ping值大约80ms，性价比最高。
* 推荐设置一个自动释放时间AutoReleaseTime，否则1小时后服务器可能会被自动回收。
* 带宽上限InternetMaxBandwidthOut预设值是10(M)，你可以根据需求调整。
* ECS的其它配置保持默认即可。
* 阿里云海外节点地域对应表: 

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


# 启动
* 执行 `npm start`，然后等待即可。
* 命令是按照windows配置的，linux/mac上可以这样手动执行脚本：<br/>
  `node index.js | ./node_modules/.bin/bunyan`<br/>
   bunyan是日志过滤工具，不用也可以
* 整个脚本运行大概需要3 ~ 5分钟，最后会打印出SSH连接信息，可以远程管理服务器。

# 参考
* [阿里云 OpenAPI Explorer](https://api.aliyun.com/#/)
* [Google BBR是什么？以及在 CentOS 7 上如何部署](https://www.codercto.com/a/25431.html) - 本项目中的版本为了自动化去掉了原shell脚本的用户交互部分
* [forward.js](https://github.com/sjitech/forward.js) - nodejs端口转发工具，因为这不是个node模块，因此直接引用源代码
* [加入作者的QQ群](https://jq.qq.com/?_wv=1027&k=5osCydC) - JavaScript开发者的小圈子
* [立即开通阿里云！](https://promotion.aliyun.com/ntms/yunparter/invite.html?userCode=u2h4dcnl)
