import React from 'react'
import { useTheme } from '@mui/material/styles'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'

export const APP_DIALOG_CANCEL_BUTTON_SX = {
  textTransform: 'none',
  px: 3,
  py: 1,
  minWidth: '100px',
}

export const APP_DIALOG_PRIMARY_BUTTON_SX = {
  textTransform: 'none',
  px: 3,
  py: 1,
  minWidth: '100px',
  fontWeight: 600,
}

export function getAppDialogCancelButtonSx(theme) {
  return {
    ...APP_DIALOG_CANCEL_BUTTON_SX,
    borderColor:
      theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.23)'
        : 'rgba(0, 0, 0, 0.23)',
    color: theme.palette.text.primary,
    '&:hover': {
      borderColor:
        theme.palette.mode === 'dark'
          ? 'rgba(255, 255, 255, 0.3)'
          : 'rgba(0, 0, 0, 0.3)',
      backgroundColor:
        theme.palette.mode === 'dark'
          ? 'rgba(255, 255, 255, 0.05)'
          : 'rgba(0, 0, 0, 0.04)',
    },
  }
}

function AppDialog({
  open,
  onClose,
  title,
  titleId,
  description,
  descriptionId,
  actions,
  children,
  maxWidth = 'sm',
  fullWidth = false,
  PaperProps,
  contentSx,
  actionsSx,
  titleSx,
  showTitleDivider = false,
  ...dialogProps
}) {
  const theme = useTheme()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      fullWidth={fullWidth}
      maxWidth={maxWidth}
      PaperProps={{
        sx: {
          minWidth: { xs: '90%', sm: '400px' },
          ...PaperProps?.sx,
        },
        ...PaperProps,
      }}
      {...dialogProps}
    >
      <DialogTitle
        id={titleId}
        sx={{
          borderBottom: showTitleDivider ? `1px solid ${theme.palette.divider}` : 0,
          ...titleSx,
        }}
      >
        {title}
      </DialogTitle>
      <DialogContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          px: 3,
          pb: 2.25,
          // MUI zeroes padding-top when DialogContent follows DialogTitle; keep room for outlined labels.
          '&&': {
            paddingTop: theme.spacing(2.75),
          },
          ...contentSx,
        }}
      >
        {description ? (
          <DialogContentText
            id={descriptionId}
            sx={{
              color: theme.palette.text.secondary,
              fontSize: '0.9375rem',
              lineHeight: 1.65,
              m: 0,
            }}
          >
            {description}
          </DialogContentText>
        ) : null}
        {children}
      </DialogContent>
      {actions ? (
        <DialogActions
          sx={{
            px: 3,
            pt: 2,
            pb: 2.5,
            ...actionsSx,
          }}
        >
          {actions}
        </DialogActions>
      ) : null}
    </Dialog>
  )
}

export default AppDialog
