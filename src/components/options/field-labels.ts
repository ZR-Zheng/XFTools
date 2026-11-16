/** Keep full instructions in help; use a short, visible label beside the control. */
export function fieldLabel(
  description: string | undefined,
  name: string | undefined,
  english: boolean
): string {
  const text = `${name || ''} ${description || ''}`;
  const entries: [RegExp, string, string][] = [
    [
      /max.*(?:size|file)|maximum.*size|文件.*上限|最大.*大小|大小.*限制|文件.*大小/i,
      '文件大小上限',
      'Maximum file size'
    ],
    [/quality|质量/i, '质量', 'Quality'],
    [/similarity|相似/i, '颜色容差', 'Color tolerance'],
    [/opacity|不透明|透明度/i, '不透明度', 'Opacity'],
    [/width|宽度/i, '宽度', 'Width'],
    [/height|高度/i, '高度', 'Height'],
    [/quote character|引号字符/i, '引号字符', 'Quote character'],
    [
      /input.*(?:separator|delimiter)|(?:separator|delimiter).*input|输入.*分隔/i,
      '输入分隔符',
      'Input separator'
    ],
    [
      /output.*(?:separator|delimiter)|(?:separator|delimiter).*output|输出.*分隔/i,
      '输出分隔符',
      'Output separator'
    ],
    [/separator|delimiter|分隔/i, '分隔符', 'Separator'],
    [/comment|注释/i, '注释标记', 'Comment marker'],
    [/decimal|precision|小数|精度/i, '小数位数', 'Decimal places'],
    [/salt|轮数|加盐/i, '计算轮数', 'Cost factor'],
    [/start|起始|开始/i, '起始值', 'Start'],
    [/end|结束|终止/i, '结束值', 'End'],
    [/length|长度/i, '长度', 'Length'],
    [/count|number of|数量|次数/i, '数量', 'Count'],
    [/prefix|前缀/i, '前缀', 'Prefix'],
    [/suffix|后缀/i, '后缀', 'Suffix'],
    [/regular expression|正则/i, '正则表达式', 'Regular expression'],
    [/rotation|angle|角度/i, '旋转角度', 'Angle'],
    [/percentage|百分比|比例/i, '比例', 'Percentage'],
    [/padding|补齐|填充/i, '补齐字符', 'Padding'],
    [/color|颜色/i, '颜色', 'Color']
  ];
  for (const [pattern, zh, en] of entries)
    if (pattern.test(text)) return english ? en : zh;
  const first = description?.split(/[。！？\n]|\. /)[0]?.trim();
  if (first && first.length <= (english ? 42 : 18)) return first;
  return english ? 'Value' : '参数值';
}
