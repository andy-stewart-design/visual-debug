import SessionIndicator from './components/session-indicator';
import MeasurementOverlay from './components/measurement-overlay';
import SelectionOverlay from './components/selection-overlay';
import type { Accessor } from 'solid-js';
import type { SelectionState } from './lib/selection';

type AppProps = {
  onExit: () => void;
  selection: Accessor<SelectionState>;
  held: Accessor<boolean>;
};

export default function App(props: AppProps) {
  return (
    <>
      <SelectionOverlay selection={props.selection} held={props.held} />
      <MeasurementOverlay selection={props.selection} held={props.held} />
      <SessionIndicator onExit={props.onExit} />
    </>
  );
}
