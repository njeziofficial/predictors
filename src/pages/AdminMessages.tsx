import AdminLayout from "@/components/AdminLayout";
import ChatWorkspace from "@/components/chat/ChatWorkspace";

// Same messaging as players get, inside the back office, plus announcements for admins allowed them.
const AdminMessages = () => (
  <AdminLayout fill>
    <ChatWorkspace basePath="/admin/messages" />
  </AdminLayout>
);

export default AdminMessages;
