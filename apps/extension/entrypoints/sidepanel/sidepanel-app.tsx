import Sidebar from '../../components/sidebar';
import SidebarControls from '../../components/sidebar-controls';
import SidebarInstructions from '../../components/sidebar-instructions';
import SidebarStatus from '../../components/sidebar-status';
import { useSidebarConnection } from './use-sidebar-connection';

export default function SidepanelApp() {
  const connection = useSidebarConnection();
  const canStop = () => {
    const current = connection.view();
    return current?.tabId !== undefined &&
      (current.status === 'active' || current.status === 'pending');
  };

  return (
    <Sidebar>
      <SidebarStatus view={connection.view} connectionError={connection.connectionError} />
      <SidebarInstructions />
      <SidebarControls
        canStart={connection.view()?.canStart === true && connection.view()?.status !== 'pending'}
        canStop={canStop()}
        onStart={connection.start}
        onStop={connection.stop}
      />
    </Sidebar>
  );
}
