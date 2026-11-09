import SessionIndicator from './components/session-indicator';
import SelectionOverlay from './components/selection-overlay';
import type { Accessor } from 'solid-js';
import type { SelectionState } from './lib/selection';

type AppProps = {
  onExit: () => void;
  selection: Accessor<SelectionState>;
};

export default function App(props: AppProps) {
  return (
    <>
      <SelectionOverlay selection={props.selection} />
      <SessionIndicator onExit={props.onExit} />
    </>
  );
}
