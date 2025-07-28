import React, { useCallback, useState } from 'react';
import { UploadIcon } from './Icons';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      onFileUpload(files[0]);
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
        onChange={onInputChange}
      />
      <label htmlFor="file-upload" className="cursor-pointer">
        <UploadIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-cloud/60" />
        <span className="mt-2 block text-lg font-semibold text-gray-800 dark:text-cloud">
          Upload a .docx file
        </span>
        <p className="mt-1 block text-sm text-gray-500 dark:text-cloud/60">
          or drag and drop
        </p>
      </label>
    </div>
  );
};