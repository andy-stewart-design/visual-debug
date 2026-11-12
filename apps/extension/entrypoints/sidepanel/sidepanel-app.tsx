import Sidebar from '../../components/sidebar';
import SidebarControls from '../../components/sidebar-controls';
import PaddingSection from '../../components/padding-section';
import { useSidebarConnection } from './use-sidebar-connection';

export default function SidepanelApp() {
  const connection = useSidebarConnection();
  return (
    <Sidebar>
      <SidebarControls
        presentation={connection.presentation}
        connectionError={connection.connectionError}
        onStart={connection.start}
        onStop={connection.stop}
        onRefresh={connection.refresh}
      />
      <PaddingSection presentation={connection.presentation} onPreview={connection.preview} />
    </Sidebar>
  );
}
