import SessionIndicator from './components/session-indicator';

type AppProps = {
  onExit: () => void;
};

export default function App(props: AppProps) {
  return <SessionIndicator onExit={props.onExit} />;
}
