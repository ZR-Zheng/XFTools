const zh = {
  all: '全部工具',
  search: '搜索工具',
  empty: '还没有找到工具',
  skip: '跳转到主要内容',
  back: '返回全部工具',
  settings: '工具选项',
  notFound: '这个页面走丢了',
  notFoundSub: '工具地址可能已更改，回到工作台继续查找。',
  resetSearch: '清除搜索',
  categoryNotFound: '没有找到这个分类'
};
type WorkbenchKey = keyof typeof zh;
export function useWorkbenchText() {
  return { w: (key: WorkbenchKey) => zh[key], english: false };
}
