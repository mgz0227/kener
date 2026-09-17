// Display labels only. Keep API values and saved configuration keys unchanged.
export const monitorStatusLabels: Record<string, string> = {
  UP: "正常",
  DOWN: "故障",
  DEGRADED: "性能下降",
  MAINTENANCE: "维护中",
  UNKNOWN: "未知",
  NO_DATA: "暂无数据",
};

export const monitorTypeLabels: Record<string, string> = {
  NONE: "手动监控",
  API: "HTTP/API",
  PING: "Ping 检测",
  TCP: "TCP 端口",
  DNS: "DNS",
  SSL: "SSL 证书",
  SQL: "数据库",
  GRPC: "gRPC 健康检查",
  PROMETHEUS: "Prometheus",
  DOCKER: "Docker 容器",
  GROUP: "监控组",
  HEARTBEAT: "心跳",
  GAMEDIG: "游戏服务器",
};

export const hostTypeLabels: Record<string, string> = {
  IP4: "IPv4",
  IP6: "IPv6",
  DOMAIN: "域名",
};

export const monitoringDataTypeLabels: Record<string, string> = {
  REALTIME: "实时监测",
  MANUAL: "手动录入",
  WEBHOOK: "回调",
  DEFAULT: "默认状态",
  SIGNAL: "心跳信号",
  INCIDENT: "故障事件",
  MAINTENANCE: "维护计划",
  TIMEOUT: "超时",
  ERROR: "错误",
};

export const colorPickerTexts = {
  label: {
    h: "色相",
    s: "饱和度",
    v: "亮度",
    r: "红色通道",
    g: "绿色通道",
    b: "蓝色通道",
    a: "透明度",
    hex: "十六进制颜色",
    withoutColor: "无颜色",
  },
  color: { rgb: "RGB", hsv: "HSV", hex: "HEX" },
  changeTo: "切换为 ",
  swatch: {
    ariaTitle: "已保存的颜色",
    ariaLabel: (color: string) => `选择颜色：${color}`,
  },
};
