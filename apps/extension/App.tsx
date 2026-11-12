import MeasurementOverlay from './components/measurement-overlay';
import BoxModelOverlay from './components/box-model-overlay';
import SelectionOverlay from './components/selection-overlay';
import type { PaddingPreview } from './lib/session';
import type { Accessor } from 'solid-js';
import type { SelectionState } from './lib/selection';

type AppProps = {
  selection: Accessor<SelectionState>;
  held: Accessor<boolean>;
  preview: Accessor<PaddingPreview | undefined>;
  getAnchor: () => Element | undefined;
};

export default function App(props: AppProps) {
  return (
    <>
      <BoxModelOverlay selection={props.selection} preview={props.preview} getAnchor={props.getAnchor} />
      <SelectionOverlay selection={props.selection} held={props.held} />
      <MeasurementOverlay selection={props.selection} held={props.held} />
    </>
  );
}
