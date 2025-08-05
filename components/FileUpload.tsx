import React, { useCallback, useState } from 'react';
import { UploadIcon, BackArrowIcon } from './Icons';

interface FileUploadProps {
  onFileUpload: (files: File[]) => void;
  onBack?: () => void;
  maxFiles?: number;
  existingFiles?: string[];
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileUpload, 
  onBack,
  maxFiles = 10,
  existingFiles = []
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      const validFiles = fileArray.filter(file => {
        // Check file type
        const isValidType = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                           file.name.toLowerCase().endsWith('.docx');
        
        // Check if file already exists
        const isDuplicate = existingFiles.includes(file.name);
        
        return isValidType && !isDuplicate;
      });

      if (validFiles.length > 0) {
        // Respect max files limit
        const filesToUpload = validFiles.slice(0, maxFiles - existingFiles.length);
        onFileUpload(filesToUpload);
      }
    }
  };

  const onDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files);
  }, [handleFileChange]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e.target.files);
  };
  
  const baseClasses = "relative block w-full max-w-2xl mx-auto rounded-lg border-2 border-dashed p-12 text-center transition-colors duration-200 ease-in-out";
  const draggingClasses = "border-teal dark:border-lilac bg-teal-50 dark:bg-midnight-light/50";
  const idleClasses = "border-gray-300 dark:border-midnight-lighter hover:border-teal/70 dark:hover:border-lilac/50";

  return (
    <div className="relative">
      {onBack && (
        <button
          onClick={onBack}
          className="absolute -top-2 -left-2 z-10 flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-cloud/70 hover:text-gray-900 dark:hover:text-cloud transition-colors duration-200"
        >
          <BackArrowIcon className="w-4 h-4" />
          Back to Model Selection
        </button>
      )}
      <div 
        className={`${baseClasses} ${isDragging ? draggingClasses : idleClasses}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
      >
        <input
          id="file-upload"
          name="file-upload"
          type="file"
          className="sr-only"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          onChange={onInputChange}
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <UploadIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-cloud/60" />
          <span className="mt-2 block text-lg font-semibold text-gray-800 dark:text-cloud">
            Upload .docx files
          </span>
          <p className="mt-1 block text-sm text-gray-500 dark:text-cloud/60">
            or drag and drop multiple files
          </p>
          <p className="mt-2 text-xs text-gray-400 dark:text-cloud/50">
            {existingFiles.length > 0 
              ? `${existingFiles.length} files uploaded • ${maxFiles - existingFiles.length} remaining`
              : `Up to ${maxFiles} files supported`
            }
          </p>
        </label>
      </div>
    </div>
  );
};