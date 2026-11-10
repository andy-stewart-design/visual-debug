import { render } from 'solid-js/web';
import SidepanelApp from './sidepanel-app';

const root = document.getElementById('root');
if (root === null) throw new Error('Visual Debug sidebar root is missing.');

render(() => <SidepanelApp />, root);
