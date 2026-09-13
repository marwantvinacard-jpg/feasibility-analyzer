import React, { useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { FileData } from '../types';

interface FileUploadProps {
  label: string;
  subLabel?: string;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  files: FileData[];
  onFilesChange: (files: FileData[]) => void;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  subLabel,
  accept = "image/*",
  multiple = false,
  maxFiles = 1,
  files,
  onFilesChange,
  className = ""
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: File[] = Array.from(e.target.files);
      
      const processFiles = async () => {
        const processedFiles: FileData[] = await Promise.all(
          newFiles.map(async (file) => {
            return new Promise<FileData>((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => resolve({
                id: Math.random().toString(36).substr(2, 9),
                url: URL.createObjectURL(file),
                file,
                base64: (reader.result as string).split(',')[1] // Remove data prefix
              });
              reader.onerror = error => reject(error);
            });
          })
        );

        if (multiple) {
          const combined = [...files, ...processedFiles].slice(0, maxFiles);
          onFilesChange(combined);
        } else {
          onFilesChange([processedFiles[0]]);
        }
      };
      
      processFiles();
      // Reset input
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    onFilesChange(files.filter(f => f.id !== id));
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-end mb-2">
        <label className="block text-sm font-bold text-charcoal uppercase tracking-wider">{label}</label>
        {subLabel && <span className="text-xs text-gray-500 italic">{subLabel}</span>}
      </div>
      
      <div 
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gold-400 hover:bg-gold-50 transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[160px]"
        onClick={() => inputRef.current?.click()}
      >
        <input 
          ref={inputRef}
          type="file" 
          accept={accept} 
          multiple={multiple} 
          className="hidden" 
          onChange={handleFileChange}
        />
        
        <div className="bg-gray-100 p-3 rounded-full mb-3">
          <Upload className="w-6 h-6 text-gray-600" />
        </div>
        <p className="text-sm text-gray-600 font-medium">Click to upload</p>
        <p className="text-xs text-gray-400 mt-1">
          {multiple ? `Up to ${maxFiles} images` : 'Single image'}
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {files.map(file => (
            <div key={file.id} className="relative group aspect-video bg-gray-100 rounded-md overflow-hidden border border-gray-200">
              <img src={file.url} alt={file.file?.name || 'Uploaded preview'} className="w-full h-full object-cover" />
              <button
                onClick={() => removeFile(file.id)}
                aria-label={`Remove ${file.file?.name || 'file'}`}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
