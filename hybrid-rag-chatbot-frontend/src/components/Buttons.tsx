// frontend/src/components/Buttons.tsx

import React, { useState } from 'react';
import { X, Download, Trash2, FileSpreadsheet, Loader } from 'lucide-react';
import { getFilesByChatAndCategory, deleteFileByCategory } from '../services/api';

type TabKey = 'purchase' | 'hr' | 'finance';

interface ButtonsProps {
  chatId: string;  // 🔥 REQUIRED FOR ISOLATION
  onSelect?: (key: TabKey) => void;
}

interface FileItem {
  file_id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  file_type: string;
  category: string;
  uploaded_at: string;
  description?: string;
}

const Buttons: React.FC<ButtonsProps> = ({ chatId, onSelect }) => {
  const [active, setActive] = useState<TabKey | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TabKey | null>(null);

  const COLORS = {
    sidebarBg: '#24252D',
    highlight: '#A689FF',
    active: '#8D74DA',
    text: '#FFFFFF',
  };

  // ========================================
  // FETCH FILES (CHAT ISOLATED)
  // ========================================
  const fetchFiles = async (category: TabKey) => {
    setLoading(true);
    try {
      console.log('📥 Fetching files | Chat:', chatId, '| Category:', category);

      const response = await getFilesByChatAndCategory(chatId, category);

      console.log('✅ Files loaded:', response);
      setFiles(response.files || []);
    } catch (error) {
      console.error('❌ Failed to fetch files:', error);
      alert('Failed to load files. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // BUTTON CLICK
  // ========================================
  const click = async (key: TabKey) => {
    if (!chatId) {
      alert('No active chat selected.');
      return;
    }

    setActive(key);
    onSelect?.(key);

    setSelectedCategory(key);
    setShowModal(true);

    await fetchFiles(key);
  };

  // ========================================
  // CLOSE MODAL
  // ========================================
  const closeModal = () => {
    setShowModal(false);
    setActive(null);
    setSelectedCategory(null);
  };

  // ========================================
  // DELETE FILE (CHAT SAFE)
  // ========================================
  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    try {
      console.log('🗑️ Deleting file:', fileId, '| Chat:', chatId);

      await deleteFileByCategory(chatId, fileId);

      console.log('✅ File deleted successfully');

      if (selectedCategory) {
        await fetchFiles(selectedCategory);
      }

      alert('File deleted successfully!');
    } catch (error) {
      console.error('❌ Failed to delete file:', error);
      alert('Failed to delete file. Please try again.');
    }
  };

  // ========================================
  // DOWNLOAD (STUB)
  // ========================================
  const handleDownload = (file: FileItem) => {
    console.log('📥 Download file:', file.original_filename);
    alert(`Download functionality for "${file.original_filename}" will be implemented soon!`);
  };

  // ========================================
  // FORMAT HELPERS
  // ========================================
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ========================================
  // UI
  // ========================================
  return (
    <>
      <div style={{ width: '100%', display: 'flex', gap: 12 }}>
        {(['purchase', 'hr', 'finance'] as TabKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => click(key)}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 14,
              border: `1px solid ${COLORS.highlight}55`,
              color: COLORS.text,
              background:
                active === key && showModal
                  ? `linear-gradient(135deg, ${COLORS.highlight} 0%, ${COLORS.active} 100%)`
                  : `linear-gradient(180deg, ${COLORS.sidebarBg} 0%, #1d1e24 100%)`,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {key.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ================= MODAL ================= */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={closeModal}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 32,
              width: '90%',
              maxWidth: 700,
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>
                {selectedCategory} Files ({files.length})
              </h2>
              <button onClick={closeModal} style={{ background: 'transparent', border: 'none' }}>
                <X size={22} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 50 }}>
                  <Loader size={40} />
                  <p>Loading files...</p>
                </div>
              ) : files.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 50 }}>
                  <FileSpreadsheet size={60} />
                  <p>No files uploaded yet</p>
                </div>
              ) : (
                files.map((file) => (
                  <div
                    key={file.file_id}
                    style={{
                      padding: 16,
                      border: '1px solid #E5E7EB',
                      borderRadius: 12,
                      marginBottom: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <FileSpreadsheet size={30} />

                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>
                        {file.original_filename}
                      </p>
                      <p style={{ margin: 0, fontSize: 12 }}>
                        {formatFileSize(file.file_size)} • {formatDate(file.uploaded_at)}
                      </p>
                    </div>

                    <button onClick={() => handleDownload(file)}>
                      <Download size={16} />
                    </button>

                    <button onClick={() => handleDelete(file.file_id, file.original_filename)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Buttons;