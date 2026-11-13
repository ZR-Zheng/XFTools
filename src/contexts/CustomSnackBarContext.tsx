import { createContext, FC, ReactNode } from 'react';
import { Zoom } from '@mui/material';
import { useSnackbar } from 'notistack';
import { uiText } from 'i18n/uiText';

type CustomSnackBarContext = {
  showSnackBar: (message: string, type: 'error' | 'success') => void;
};

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const CustomSnackBarContext = createContext<CustomSnackBarContext>(
  {} as CustomSnackBarContext
);

interface Props {
  children: ReactNode;
}

export const CustomSnackBarProvider: FC<Props> = ({ children }) => {
  const { enqueueSnackbar } = useSnackbar();
  const showSnackBar = (message: string, type: 'error' | 'success') => {
    enqueueSnackbar(uiText(message), {
      variant: type,
      anchorOrigin: {
        vertical: 'top',
        horizontal: 'right'
      },
      TransitionComponent: Zoom
    });
  };
  return (
    <CustomSnackBarContext.Provider value={{ showSnackBar }}>
      {children}
    </CustomSnackBarContext.Provider>
  );
};
