import { createTheme } from '@mui/material/styles'

/**
 * Polar day palette. MUI only needs to know the two accents and the ground -
 * the rest of the theme lives in CSS variables (see index.scss) so styled
 * components and Phaser can read the same colours.
 */
const muiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2b8fc4', // glacier
    },
    secondary: {
      main: '#17c9a0', // aurora mint
    },
    background: {
      default: '#f4fbff',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f3a5c',
      secondary: '#4a7292',
    },
  },
  typography: {
    fontFamily: "'Gowun Dodum', 'Apple SD Gothic Neo', sans-serif",
    button: {
      fontFamily: "'Jua', 'Apple SD Gothic Neo', sans-serif",
      textTransform: 'none',
    },
  },
})

export default muiTheme
