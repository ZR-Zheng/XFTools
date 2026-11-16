import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { uiText } from 'i18n/uiText';
type Notice = { id: number; message: string; type: 'error' | 'success' };
export const CustomSnackBarContext = createContext({
  showSnackBar: (_message: string, _type: Notice['type']) => {}
});
export function CustomSnackBarProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const nextId = useRef(0);
  const showSnackBar = useCallback((message: string, type: Notice['type']) => {
    const id = ++nextId.current;
    setNotices((current) =>
      [
        ...current.filter((item) => item.message !== message),
        { id, message: uiText(message), type }
      ].slice(-3)
    );
    const timer = setTimeout(
      () => {
        setNotices((current) => current.filter((item) => item.id !== id));
        timers.current.delete(timer);
      },
      type === 'error' ? 6500 : 3500
    );
    timers.current.add(timer);
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return (
    <CustomSnackBarContext.Provider value={{ showSnackBar }}>
      {children}
      <div className="toast-stack">
        {notices.map((item) => (
          <div
            key={item.id}
            className={`toast toast-${item.type}`}
            role={item.type === 'error' ? 'alert' : 'status'}
          >
            <span>{item.message}</span>
            <button
              type="button"
              aria-label={uiText('Close')}
              onClick={() =>
                setNotices((current) =>
                  current.filter((notice) => notice.id !== item.id)
                )
              }
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </CustomSnackBarContext.Provider>
  );
}
