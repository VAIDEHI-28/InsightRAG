// frontend/src/components/FileUploadModal.tsx
import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, Trash2 } from 'lucide-react';
import { uploadFileWithCategory } from '../services/api';


interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string; 
  defaultCategory?: 'purchase' | 'hr' | 'finance' | 'other';
}


const FileUploadModal: React.FC<FileUploadModalProps> = ({ 
  isOpen, 
  onClose,
  chatId,
  defaultCategory = 'purchase'
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);  // ← Changed to array
  const [category, setCategory] = useState<string>(defaultCategory);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: boolean }>({});


  if (!isOpen) return null;


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      
      // Validate file types
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
      ];
      
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      
      const validFiles = filesArray.filter(file => {
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        return validTypes.includes(file.type) || validExtensions.includes(fileExtension);
      });

      const invalidCount = filesArray.length - validFiles.length;
      
      if (invalidCount > 0) {
        alert(`${invalidCount} file(s) skipped. Only Excel files (.xlsx, .xls, .csv) are allowed.`);
      }
      
      if (validFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...validFiles]);  // ← Add to existing files
      }
    }
  };


  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };


  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);


    if (e.dataTransfer.files) {
      const filesArray = Array.from(e.dataTransfer.files);
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      
      const validFiles = filesArray.filter(file => {
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        return validExtensions.includes(fileExtension);
      });

      const invalidCount = filesArray.length - validFiles.length;
      
      if (invalidCount > 0) {
        alert(`${invalidCount} file(s) skipped. Only Excel files (.xlsx, .xls, .csv) are allowed.`);
      }
      
      if (validFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...validFiles]);
      }
    }
  };


  // Remove individual file
  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  if (!chatId) {
    alert("No active chat selected.");
    return;
  }
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select at least one file');
      return;
    }


    setIsUploading(true);
    
    try {
      console.log(`📤 Uploading ${selectedFiles.length} file(s)`);
      console.log('📂 Category:', category);
      
      let successCount = 0;
      let failCount = 0;

      // Upload files one by one
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        try {
          console.log(`⬆️ Uploading file ${i + 1}/${selectedFiles.length}: ${file.name}`);
          
          const response = await uploadFileWithCategory(
            file, 
            chatId,
            category as 'purchase' | 'hr' | 'finance' | 'other'
          );
          
          console.log(`✅ File ${i + 1} uploaded:`, response);
          successCount++;
          
        } catch (error: any) {
          console.error(`❌ Failed to upload ${file.name}:`, error);
          failCount++;
        }
      }
      
      // Show summary
      if (successCount > 0 && failCount === 0) {
        alert(`✅ All ${successCount} file(s) uploaded successfully to ${category.toUpperCase()} category!`);
      } else if (successCount > 0 && failCount > 0) {
        alert(`⚠️ ${successCount} file(s) uploaded successfully, ${failCount} failed.`);
      } else {
        alert(`❌ All uploads failed. Please try again.`);
      }
      
      // Reset and close if at least one succeeded
      if (successCount > 0) {
        setSelectedFiles([]);
        setCategory(defaultCategory);
        onClose();
      }
      
    } catch (error: any) {
      console.error('❌ Upload failed:', error);
      alert(`Failed to upload files: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };


  const handleClose = () => {
    setSelectedFiles([]);
    setCategory(defaultCategory);
    onClose();
  };


  const getTotalSize = () => {
    return selectedFiles.reduce((total, file) => total + file.size, 0);
  };


  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };


  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '32px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#1F2937',
              margin: 0,
            }}
          >
            Upload Excel Files
          </h2>
          <button
            onClick={handleClose}
            style={{
              padding: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F3F4F6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={24} style={{ color: '#6B7280' }} />
          </button>
        </div>


        {/* Category Dropdown */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px',
            }}
          >
            Select Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              fontSize: '14px',
              backgroundColor: '#F9FAFB',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="purchase">Purchase</option>
            <option value="hr">HR</option>
            <option value="finance">Finance</option>
            <option value="other">Other</option>
          </select>
        </div>


        {/* Drag & Drop Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragActive ? '#A689FF' : '#E5E7EB'}`,
            borderRadius: '16px',
            padding: '32px 20px',
            textAlign: 'center',
            backgroundColor: dragActive ? '#F4F7FC' : '#F9FAFB',
            transition: 'all 0.3s',
            marginBottom: '16px',
            cursor: 'pointer',
          }}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <FileSpreadsheet
            size={48}
            style={{
              color: selectedFiles.length > 0 ? '#A689FF' : '#9CA3AF',
              margin: '0 auto 16px',
            }}
          />
          
          <p
            style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              margin: '0 0 8px 0',
            }}
          >
            Drag and drop your Excel files here
          </p>
          <p
            style={{
              fontSize: '12px',
              color: '#6B7280',
              margin: '0 0 12px 0',
            }}
          >
            or click to browse
          </p>
          <p
            style={{
              fontSize: '11px',
              color: '#9CA3AF',
              margin: 0,
            }}
          >
            Supported formats: .xlsx, .xls, .csv • Multiple files allowed
          </p>


          <input
            id="file-input"
            type="file"
            multiple  // ← Enable multiple file selection
            accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>


        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              marginBottom: '16px',
              maxHeight: '250px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid #E5E7EB',
              }}
            >
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  margin: 0,
                }}
              >
                Selected Files ({selectedFiles.length})
              </p>
              <p
                style={{
                  fontSize: '12px',
                  color: '#6B7280',
                  margin: 0,
                }}
              >
                Total: {formatFileSize(getTotalSize())}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    backgroundColor: '#F9FAFB',
                    borderRadius: '10px',
                    border: '1px solid #E5E7EB',
                  }}
                >
                  <FileSpreadsheet size={24} style={{ color: '#A689FF', flexShrink: 0 }} />
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#1F2937',
                        margin: '0 0 2px 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {file.name}
                    </p>
                    <p
                      style={{
                        fontSize: '11px',
                        color: '#6B7280',
                        margin: 0,
                      }}
                    >
                      {formatFileSize(file.size)}
                    </p>
                  </div>

                  <button
                    onClick={() => handleRemoveFile(index)}
                    disabled={isUploading}
                    style={{
                      padding: '6px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 0.2s',
                      opacity: isUploading ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isUploading) {
                        e.currentTarget.style.backgroundColor = '#FEE2E2';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Trash2 size={16} style={{ color: '#EF4444' }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={handleClose}
            disabled={isUploading}
            style={{
              padding: '12px 24px',
              backgroundColor: '#F3F4F6',
              color: '#374151',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isUploading) {
                e.currentTarget.style.backgroundColor = '#E5E7EB';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#F3F4F6';
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            style={{
              padding: '12px 24px',
              backgroundColor: selectedFiles.length > 0 && !isUploading ? '#A689FF' : '#D1D5DB',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: selectedFiles.length > 0 && !isUploading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (selectedFiles.length > 0 && !isUploading) {
                e.currentTarget.style.backgroundColor = '#8D74DA';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedFiles.length > 0 && !isUploading) {
                e.currentTarget.style.backgroundColor = '#A689FF';
              }
            }}
          >
            <Upload size={16} />
            {isUploading ? `Uploading ${selectedFiles.length} file(s)...` : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};


export default FileUploadModal;
