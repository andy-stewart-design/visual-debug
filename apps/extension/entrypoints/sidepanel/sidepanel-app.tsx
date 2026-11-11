import Sidebar from '../../components/sidebar';
import SidebarControls from '../../components/sidebar-controls';
import SidebarInstructions from '../../components/sidebar-instructions';
import SidebarStatus from '../../components/sidebar-status';
import { useSidebarConnection } from './use-sidebar-connection';

export default function SidepanelApp() {
  const connection = useSidebarConnection();
  return (
    <Sidebar>
      <SidebarStatus presentation={connection.presentation} />
      <SidebarInstructions />
      <SidebarControls
        actions={() => connection.presentation().actions}
        onStart={connection.start}
        onStop={connection.stop}
        onRefresh={connection.refresh}
      />
    </Sidebar>
  );
}
