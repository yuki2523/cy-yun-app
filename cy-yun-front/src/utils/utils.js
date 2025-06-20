import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

export const formatDate = (date, dateFormat = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return '-';
  // 计算Asia/Shanghai与本地时区的时差（小时）
  const now = new Date();
  // Asia/Shanghai的UTC偏移（东八区，固定为-480分钟）
  const shanghaiOffset = -8 * 60;
  // 本地时区的UTC偏移（分钟，西区为正，东区为负）
  const localOffset = now.getTimezoneOffset(); // 本地时区的偏移，单位为分钟，正数表示本地比上海晚，负数表示本地比上海早
  // 时差 = (本地-上海)/60，正数表示本地比上海晚，负数表示本地比上海早
  return dayjs(date).subtract(localOffset - shanghaiOffset, 'minutes').utc().format(dateFormat);
}