import {createElement} from 'react';
import htm from 'htm';
// JSX-free components: html`<${Box}>…</${Box}>` (no build step, runs on plain Node).
export const html=htm.bind(createElement);
