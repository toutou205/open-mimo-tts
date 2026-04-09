# 局域网服务器与 SSH 维护上下文模板

## 文档定位

这份文档不是单纯的 OpenClaw 部署说明，而是这台局域网服务器的全景概览。

目标是让后续任何新对话、新 agent、或新的工程任务，在拿到这份文档后，都能快速理解：

- 这台机器是什么
- 这台机器上跑了哪些基础设施
- 各个系统如何分层
- 各个入口如何访问
- 哪些服务归谁管理
- 哪些地方适合继续扩展
- 哪些地方存在运行和运维风险

本文内容以本次 SSH 实地盘点为准，适合作为“局域网服务器城市规划档案”的基础版本。

盘点快照时间：

- 盘点日期：2026-03-21
- 盘点时间：10:12:51
- 时区：UTC+08:00（Asia/Shanghai）
- 盘点方式：通过 `ssh alex@192.168.3.17` 远程读取系统、服务、容器、端口、挂载与目录结构信息

---

## 1. 总体定位

这台服务器是一台长期通电的局域网边缘节点，承担了多类职责，而不是单一的 OpenClaw 主机。

当前它同时承担：

- 局域网 AI 与 Agent 网关节点
- Home Assistant 与 IoT 自动化节点
- Docker 应用承载节点
- SMB 文件共享节点
- 媒体与知识库类服务节点
- XiaoZhi MCP 项目运行节点
- OpenClaw 运维与多 Agent 实验节点

从规划视角看，这是一台“多租户边缘基础设施主机”，而不是一台只跑单一业务的应用服务器。

---

## 2. 硬件与系统底座

### 2.1 硬件信息

- 设备型号：Lenovo ThinkPad Edge E540
- CPU：Intel x86_64 平台
- 内存：约 8 GB
- 系统盘：SanDisk SSD PLUS 约 447 GB
- 数据盘：ST4000VM005 约 3.6 TB
- 固件版本：J9ET87WW (2.07)

### 2.2 操作系统

- 系统：Ubuntu 24.04.3 LTS
- 内核：Linux 6.8.0-100-generic
- 主机名：`alexthinkpad`
- SSH 用户：`alex`
- SSH 地址：`ssh alex@192.168.3.17`

### 2.3 网络与代理

- 局域网地址：`192.168.3.17`
- 常用上游代理：`http://192.168.3.10:7890`
- 代理已明确注入到 `openclaw-gateway.service`
- 当前快速检索中，没有在 `~/.profile` / `~/.bashrc` / `/etc/environment` 里看到统一的代理环境变量定义

这意味着：

- OpenClaw 服务级代理是显式配置的
- 其他服务是否走代理，需要逐项确认

---

## 3. 存储与文件系统

### 3.1 磁盘与挂载

- 系统盘：`/dev/sda2`，`ext4`，挂载到 `/`
- EFI 分区：`/dev/sda1`，挂载到 `/boot/efi`
- 数据盘：`/dev/sdb2`，`ntfs`，挂载到 `/mnt/my4t`

### 3.2 当前容量

- 根分区 `/`：约 439G，总使用约 58G
- 外接数据盘 `/mnt/my4t`：约 3.7T，总使用约 1.1T，剩余约 2.7T

### 3.3 fstab 状态

当前 `/etc/fstab` 只包含：

- 根分区
- EFI 分区
- swap

没有看到 `/mnt/my4t` 的静态挂载项。

这说明 `/mnt/my4t` 目前更像是：

- 由 CasaOS / devmon / udisks 这类运行时机制管理
- 而不是通过传统 `fstab` 固化

这对后续规划的含义是：

- 日常使用灵活
- 但“开机后一定按同一路径挂载”的确定性略弱
- 如果后续把更多核心业务绑定到 `/mnt/my4t`，建议补充成更可控的挂载策略

---

## 4. 共享与文件入口

### 4.1 Samba 总体状态

当前系统服务中，Samba 相关服务处于运行状态：

- `smbd.service`
- `nmbd.service`

监听端口也正常存在：

- `445`
- `139`

### 4.2 CasaOS 共享定义

当前共享主要由 `/etc/samba/smb.casa.conf` 管理，已定义：

- `DATA` -> `/DATA`
- `Documents` -> `/DATA/Documents`
- `Downloads` -> `/DATA/Downloads`
- `Gallery` -> `/DATA/Gallery`
- `Media` -> `/DATA/Media`
- `my4t` -> `/mnt/my4t`

特点：

- `guest ok = Yes`
- `read only = No`
- `force user = root`
- 默认是 CasaOS 风格的开放共享

这带来两个现实特点：

- 共享入口很多，文件访问方便
- 权限边界偏宽松，更适合家用 / 实验室场景，不适合高隔离要求场景

---

## 5. 系统服务分层

从运行中的服务看，这台机器可以分成五层。

### 5.1 基础系统层

主要包括：

- `systemd-networkd.service`
- `systemd-resolved.service`
- `systemd-timesyncd.service`
- `ssh.service`
- `rsyslog.service`
- `cron.service`
- `dbus.service`

这一层负责：

- 网络
- 时间同步
- 日志
- SSH 管理
- 定时任务

### 5.2 存储与设备层

主要包括：

- `devmon@devmon.service`
- `udisks2.service`
- `smartmontools.service`
- `multipathd.service`

这一层负责：

- 可移动存储探测
- 挂载辅助
- 磁盘健康监控

### 5.3 CasaOS 平台层

主要包括：

- `casaos.service`
- `casaos-gateway.service`
- `casaos-app-management.service`
- `casaos-local-storage.service`
- `casaos-message-bus.service`
- `casaos-user-service.service`

这一层相当于服务器的“本地 PaaS 控制台”，负责：

- App 管理
- 存储展示
- Web 面板
- SMB / AppData 组织

### 5.4 容器基础设施层

主要包括：

- `docker.service`
- `containerd.service`

这一层承载了：

- Home Assistant 容器
- 趋势抓取容器
- Node-RED
- AdGuard Home
- Jellyfin
- Mosquitto
- Redis
- Cloudflared 等

### 5.5 用户级业务层

用户级 systemd 当前主要有两个核心服务：

- `openclaw-gateway.service`
- `xiaozhi-gateway.service`

这说明：

- OpenClaw 与 XiaoZhi 都采用了 `systemd --user` 托管
- 两个项目彼此独立，但共享同一台宿主机与用户空间

---

## 6. 容器与应用基础设施

当前正在运行的容器包括：

- `xiaozhi_ha` -> `ghcr.io/home-assistant/home-assistant:stable`
- `xiaozhi_trend_crawler` -> Trend Radar crawler
- `calibre-web`
- `xiaozhi_redis`
- `node-red`
- `cloudflared-tunnel`
- `mosquitto`
- `jellyfin`
- `homeassistant`
- `adguard-home`

### 6.1 面向业务的理解

这些容器大致可以分成几类：

- 智能家居：`homeassistant`, `xiaozhi_ha`
- 自动化与编排：`node-red`, `mosquitto`, `redis`
- 内容与媒体：`jellyfin`, `calibre-web`
- 网络与出口：`cloudflared-tunnel`, `adguard-home`
- 数据抓取：`xiaozhi_trend_crawler`

### 6.2 现有容器生态的特点

- 不是“单一 compose 单一项目”的形态
- 更像是 CasaOS + 手工维护并存的混合运行环境
- 当前只明确发现一个 `docker-compose.yml`：
  - `openclaw/docker-compose.yml`

这意味着：

- 不是所有容器都能通过同一个仓库和 compose 文件回溯
- 服务器实际状态比代码仓库状态更复杂
- 后续如果要做基础设施治理，建议补一份“容器来源台账”

---

## 7. 端口与入口地图

当前已确认的重要监听端口：

- `22`：SSH
- `80`：HTTP 入口
- `531` / `853`：AdGuard DNS / DoT 相关
- `1880`：Node-RED
- `1883`：Mosquitto MQTT
- `3001`：AdGuard Web 管理
- `3333`：Trend Radar Web
- `6379`：Redis
- `7359` / `8097` / `8921`：Jellyfin
- `8083`：Calibre Web
- `8123`：Home Assistant
- `9001`：Mosquitto WebSocket
- `11434`：Ollama，仅监听 `127.0.0.1`
- `18789` / `18791` / `18792`：OpenClaw Gateway 相关，仅本机回环

### 7.1 规划解读

从端口结构看：

- 对外开放和局域网服务并存
- OpenClaw 设计相对谨慎，只绑定在回环地址
- Ollama 也只在本机监听，避免直接暴露到局域网
- 反过来，AdGuard / HA / Jellyfin / MQTT / Trend Radar 更偏服务化公开入口

---

## 8. OpenClaw 层

### 8.1 代码与工作目录

- 仓库目录：`/home/alex/openclaw`
- 运行目录：`/home/alex/.openclaw`
- 主 workspace：`/home/alex/.openclaw/workspace`
- ops workspace：`/home/alex/.openclaw/workspace-ops`

### 8.2 Agent 结构

当前已经存在：

- `agents/main`
- `agents/ops`

说明这台机器已经不是单 agent 试验态，而是进入了多 agent 运行态。

### 8.3 启动方式

`openclaw-gateway.service` 当前以用户级 systemd 运行，关键特点：

- 由 Node 22.22.1 直接启动 `dist/index.js`
- 端口固定为 `18789`
- 注入了 `HTTP_PROXY` / `HTTPS_PROXY`
- 重启策略为 `Restart=always`

补充说明：

- 网关服务本身已经跑在 Node 22.22.1 上，不是系统 Node 18
- 登录 shell 现在通过 `~/.profile` 把 `/home/alex/.nvm/versions/node/v22.22.1/bin` 放在 PATH 前面，所以 `bash -lc 'node -v'` 现在会看到 `v22.22.1`
- 直接 `ssh alex@192.168.3.17 "node -v"` 这类非登录远程命令仍可能看到系统 `/usr/bin/node` `v18.19.1`
- 以后凡是需要远端构建、`pnpm`、`vite` 或 UI 修复的命令，优先显式使用登录 shell（例如 `bash -lc`）或者直接调用 `/home/alex/.nvm/versions/node/v22.22.1/bin/node`
- 不要把裸 `ssh` 里的 `node -v` 当成最终版本判断；它只代表非登录 shell 的默认 PATH

### 8.4 容器形态

仓库里同时存在 `openclaw/docker-compose.yml`，包含：

- `openclaw-gateway`
- `openclaw-cli`

说明 OpenClaw 当前同时具备两种运行思路：

- 用户级 systemd 直接跑宿主机版本
- Docker Compose 版作为备用或开发版基础设施

当前 live 服务实际使用的是：

- 用户级 systemd 版

---

## 9. XiaoZhi MCP 层

### 9.1 主路径

- 项目根目录：`/home/alex/workspace/xiaozhi/xiaozhi_mcp`

### 9.2 目录结构

主要分层已经成形：

- `1_gateway`
- `2_infrastructure`
- `3_services`
- `4_lib`
- `5_data`
- `docs`
- `reference`
- `.agent`
- `.venv`

### 9.3 当前关键子目录

- `1_gateway`：网关与 watchdog / report 相关脚本
- `2_infrastructure/ha_config`
- `2_infrastructure/redis_data`
- `2_infrastructure/trend_data`
- `2_infrastructure/trend_radar`
- `2_infrastructure/trend_radar_config`
- `3_services/core_agent`
- `3_services/ha_bridge`
- `3_services/observer`
- `5_data/sqlite`

### 9.4 启动方式

`xiaozhi-gateway.service` 当前以用户级 systemd 运行：

- WorkingDirectory 固定在 `1_gateway`
- 通过 `run_gateway.sh` 启动
- 标准输出和错误输出都追加到 `gateway.log`
- 重启策略为 `Restart=always`

### 9.5 定时任务

当前宿主机 crontab 中已确认：

- 每分钟导出环境到 `/tmp/cron_env.log`
- 每 5 分钟执行 watchdog
- 每天 UTC 01:40 执行日报
- 每天 UTC 07:20 再执行一次日报

这和现有运维设计是一致的，说明 XiaoZhi 这部分已经进入“守护 + 调度 + 报警”的持续运行态。

---

## 10. AI 与模型层

### 10.1 Ollama

当前系统级运行：

- 服务：`ollama.service`
- 启动命令：`/usr/bin/ollama serve`
- 用户：`ollama`
- 模型目录：`/usr/share/ollama/.ollama/models`
- 监听：`127.0.0.1:11434`

### 10.2 AI 工作区

`/home/alex/ai-workspace` 当前已经存在：

- `installers`
- `logs`
- `models-source`
- `scripts`

这说明这台服务器不仅跑在线服务，也承担模型导入、脚本和实验资产管理职责。

---

## 11. 其他开发与实验资产

当前 `alex` 用户目录下还能看到多组研发与实验环境：

- `.codex`
- `.cursor`
- `.cursor-server`
- `.antigravity-server`
- `.gemini`
- `.vscode-server`
- `.nvm`
- `.ollama`
- `esp`
- `esp_build`
- `ota_server`
- `Pi-Pal`
- `projects/tts-batch`
- `projects/voice_db_build`
- `projects/voice_tutor_project`

这说明这台机器已经具有“边缘服务器 + 远程开发工作站 + AI 实验主机”的复合属性。

后续规划时要避免一个常见误区：

- 不能把它只当成运维目标机
- 它同时还是开发机、实验机、资产仓库

---

## 12. SSH 维护方式

### 12.1 当前推荐入口

统一使用：

```bash
ssh alex@192.168.3.17
```

### 12.2 推荐工作方式

优先采用 headless 运维思路：

- 先 SSH 登录
- 再执行 systemd、docker、日志、端口、磁盘等命令
- 重要修复动作尽量走系统原生方式，而不是临时手工后台进程

### 12.3 适合日常维护的命令类型

- 服务状态：
  - `systemctl list-units --type=service --state=running`
  - `systemctl --user list-units --type=service --state=running`
- 端口状态：
  - `ss -ltnp`
- 容器状态：
  - `docker ps`
- 定时任务：
  - `crontab -l`
  - `systemctl --user list-timers --all`
- 存储状态：
  - `lsblk -o NAME,FSTYPE,SIZE,MOUNTPOINT,LABEL,MODEL`
  - `df -hT`
- 核心日志：
  - `journalctl --user -u openclaw-gateway.service`
  - `journalctl --user -u xiaozhi-gateway.service`

### 12.4 适合新对话复用的最小上下文

可以直接复制下面这段给新对话：

```text
目标服务器是一台局域网 Ubuntu Server 24.04.3 LTS，地址 192.168.3.17，SSH 用户 alex。
这台机器不是单一 OpenClaw 节点，而是多用途边缘服务器，长期通电运行。
系统上同时运行 CasaOS、Docker、Samba、Ollama、OpenClaw、XiaoZhi MCP、Home Assistant、Node-RED、AdGuard、Jellyfin、Mosquitto 等基础设施。
OpenClaw 通过 systemd --user 运行，服务名 openclaw-gateway.service，端口 18789，仅监听本机回环。
XiaoZhi 通过 systemd --user 运行，服务名 xiaozhi-gateway.service，项目路径 /home/alex/workspace/xiaozhi/xiaozhi_mcp。
外接 4TB NTFS 数据盘挂载在 /mnt/my4t，并通过 CasaOS/Samba 暴露共享。
常用代理为 192.168.3.10:7890。
请优先用 SSH + systemd/docker/logs 的方式排查，不要假设这里只有 OpenClaw 一个项目。
```

---

## 13. 从“城市规划”视角看当前分区

可以把这台服务器理解为以下几个城区：

### 13.1 基础设施区

- Ubuntu
- systemd
- SSH
- cron
- Docker
- Samba
- CasaOS

### 13.2 AI 运算区

- Ollama
- OpenClaw
- XiaoZhi
- 本地模型与 agent 资产

### 13.3 家居与自动化区

- Home Assistant
- Node-RED
- Mosquitto
- Redis

### 13.4 内容服务区

- Jellyfin
- Calibre Web
- Media / Books / Movies / TV

### 13.5 开发实验区

- openclaw 仓库
- XiaoZhi 仓库
- ESP / OTA / Pi-Pal / 语音项目
- Codex / Cursor / Gemini / Antigravity 相关工作目录

这个视角的意义是：

- 后续扩容时，要先判断新东西属于哪个区
- 再决定它应该挂在 systemd、Docker、CasaOS 还是用户工作区下

---

## 14. 已识别的风险与规划建议

### 14.1 风险：单机多角色过载

这台机器同时承担：

- 生产运行
- 家庭服务
- AI 实验
- 开发环境

优点是资源复用高，缺点是：

- 变更影响面大
- 排障时容易相互干扰

### 14.2 风险：容器来源不完全统一

当前 live 容器很多，但仓库侧只明确发现 `openclaw/docker-compose.yml`。

说明：

- 不少容器可能由 CasaOS 或手工方式管理
- 配置来源分散

建议后续补文档：

- 每个容器从哪里创建
- 配置文件在哪
- 数据卷在哪
- 谁是维护入口

### 14.3 风险：外接数据盘挂载确定性不够强

`/mnt/my4t` 当前不在 `/etc/fstab` 中。

建议：

- 如果未来更多关键数据依赖这块盘，补充固定挂载策略

### 14.4 风险：共享权限偏开放

CasaOS 的 Samba 配置以开放可写为主，适合便捷访问，不适合严格隔离。

如果后续需要：

- 多人协作
- 敏感资料隔离
- 更细粒度权限

建议单独重构共享策略。

### 14.5 风险：用户级 systemd 与容器并存

OpenClaw、XiaoZhi、Ollama、HA、Trend Radar 等服务横跨：

- systemd system
- systemd user
- Docker
- CasaOS

建议后续明确一套“服务治理台账”：

- 名称
- 启动方式
- 配置位置
- 日志位置
- 运维入口

---

## 15. 后续建议补充的配套文档

为了让这份全景档案进一步可执行，后续建议补三份附属文档：

1. `局域网服务器常用运维命令清单.md`
2. `局域网服务器服务治理台账.md`
3. `局域网服务器容器来源与数据卷清单.md`

这样这份文档负责“总图”，其他文档负责“施工图”和“运维手册”。

---

## 16. 本文档的使用建议

如果是新对话、新 agent 或新任务：

- 先读第 1 到第 5 节，建立整体地图
- 再读第 8 到第 12 节，确定 OpenClaw / XiaoZhi / SSH 的具体入口
- 如果是架构规划任务，再读第 13 到第 15 节

如果是排障任务：

- 先不要假设故障只和 OpenClaw 有关
- 优先把问题放回这台机器的全局分层里判断

这就是这份文档最重要的价值：

- 不是告诉我们“某一个服务怎么跑”
- 而是告诉我们“这座城现在是怎么组织的”
