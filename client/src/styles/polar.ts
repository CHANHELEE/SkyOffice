import styled, { css } from 'styled-components'

/**
 * Shared surfaces for the polar day theme.
 *
 * Every panel is a slab of sunlit ice: near-white and translucent, a cool rim
 * where the light catches the edge, and a faint sheen across the top. Keeping that
 * in one place is what stops eight dialogs from drifting into eight designs.
 */

export const iceSurface = css`
  background: var(--panel-bg);
  border: 1px solid var(--ice-edge);
  box-shadow: var(--panel-shadow);
`

/** the thin cold sheen that sits on top of every slab */
export const iceSheen = css`
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 45%;
  background: linear-gradient(180deg, #ffffffb3, transparent);
  pointer-events: none;
`

export const IcePanel = styled.div`
  position: relative;
  ${iceSurface};
  border-radius: 18px;
  overflow: hidden;

  &::before {
    ${iceSheen};
  }
`

export const PanelTitle = styled.h2`
  margin: 0;
  font-family: var(--display);
  font-weight: 400;
  font-size: 22px;
  letter-spacing: 0.02em;
  color: var(--deep-ice);
  text-align: center;
`

export const PanelNote = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--deep-ice-dim);
  text-align: center;
`

/** the low sun - the one warm thing on a white screen, reserved for "do the thing" */
export const lampButton = css`
  && {
    font-family: var(--display);
    font-size: 15px;
    letter-spacing: 0.03em;
    color: #4a2c00;
    background: linear-gradient(180deg, #ffd27a, var(--sun));
    border-radius: 999px;
    padding: 8px 26px;
    box-shadow: 0 6px 18px #ffb63866, inset 0 1px 0 #fff9;
    transition: box-shadow 0.2s, transform 0.2s;

    &:hover {
      background: linear-gradient(180deg, #ffdd97, #ffbe4d);
      box-shadow: 0 10px 24px #ffb63880, inset 0 1px 0 #fffc;
      transform: translateY(-1px);
    }
  }
`

/** quieter sibling for anything that is not the main action */
export const glacierButton = css`
  && {
    font-family: var(--display);
    font-size: 14px;
    letter-spacing: 0.03em;
    color: var(--glacier);
    background: #2b8fc40f;
    border: 1px solid var(--ice-edge);
    border-radius: 999px;
    padding: 6px 18px;
    transition: background 0.2s, border-color 0.2s;

    &:hover {
      background: #2b8fc41f;
      border-color: var(--ice-edge-strong);
    }
  }
`

/** MUI TextField wrapped in frost instead of the stock outline */
export const frostField = css`
  && {
    .MuiOutlinedInput-root {
      font-family: var(--body);
      color: var(--deep-ice);
      background: var(--surface-sunken);
      border-radius: 12px;

      fieldset {
        border-color: var(--ice-edge);
      }
      &:hover fieldset {
        border-color: var(--ice-edge-strong);
      }
      &.Mui-focused fieldset {
        border-color: var(--aurora-mint);
        box-shadow: 0 0 0 3px #17c9a029;
      }
    }

    .MuiInputLabel-root {
      font-family: var(--body);
      color: var(--deep-ice-faint);

      &.Mui-focused {
        color: var(--aurora-mint);
      }
    }
  }
`
