import React, { useState } from 'react';
import {
  FolderKanban,
  FileDown,
  FileUp,
  RotateCcw,
  Sparkles,
  Camera,
  Library,
  Ruler,
  Sliders,
  ShieldCheck,
  Zap,
  History,
  Download,
  Building,
  CheckCircle2
} from 'lucide-react';
import { Logo } from './Logo';
import { ProjectInfo, ProjectType, SpaceType } from '../types';
import { PROJECT_TYPES, SPACE_TYPES } from '../constants';

interface ProjectHeaderProps {
  projectInfo: ProjectInfo;
  setProjectInfo: React.Dispatch<React.SetStateAction<ProjectInfo>>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  viewsCount: number;
  referencesCount: number;
  docsCount: number;
  historyCount: number;
  onSaveProjectJSON: () => void;
  onLoadProjectJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetProject: () => void;
  onOpenSummaryModal: () => void;
  isGenerating: boolean;
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  projectInfo,
  setProjectInfo,
  activeTab,
  setActiveTab,
  viewsCount,
  referencesCount,
  docsCount,
  historyCount,
  onSaveProjectJSON,
  onLoadProjectJSON,
  onResetProject,
  onOpenSummaryModal,
  isGenerating,
}) => {
  const [isEditingInfo, setIsEditingInfo] = useState(false);

  const tabs = [
    { id: 'views', label: 'Multi-View Workspace', icon: Camera, count: viewsCount },
    { id: 'references', label: 'Reference Library', icon: Library, count: referencesCount },
    { id: 'plans', label: 'Plans & CAD', icon: Ruler, count: docsCount },
    { id: 'prompt', label: 'Prompt Builder', icon: Sliders },
    { id: 'preservation', label: 'Preservation Rules', icon: ShieldCheck },
    { id: 'mode', label: 'Generation Mode', icon: Zap },
    { id: 'history', label: 'Version History', icon: History, count: historyCount },
    { id: 'export', label: 'Export Suite', icon: Download },
  ];

  const statusColors = {
    Draft: 'bg-slate-100 text-slate-700 border-slate-300',
    'In Progress': 'bg-amber-50 text-amber-800 border-amber-300',
    Review: 'bg-purple-50 text-purple-800 border-purple-300',
    Approved: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    Completed: 'bg-blue-50 text-blue-800 border-blue-300',
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 shadow-xl">
      {/* Top Bar: Brand, Project Meta, Global Actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Logo & Project Title */}
          <div className="flex items-center gap-4">
            <Logo variant="header" size="sm" />
            <div className="h-8 w-[1px] bg-slate-800 hidden sm:block" />
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 text-base md:text-lg tracking-tight">
                  {projectInfo.name || 'Untitled Design Project'}
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${statusColors[projectInfo.status]}`}>
                  {projectInfo.status}
                </span>
                <button
                  onClick={() => setIsEditingInfo(!isEditingInfo)}
                  className="text-xs text-slate-400 hover:text-slate-200 underline ml-1"
                >
                  {isEditingInfo ? 'Close Edit' : 'Edit Meta'}
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <Building size={12} className="text-emerald-400" />
                  {projectInfo.projectType} • <span className="text-emerald-300 font-semibold">{projectInfo.spaceType || 'Corridor / Hallway'}</span>
                </span>
                <span className="text-slate-500">({projectInfo.roomName || 'Target Room'})</span>
                {projectInfo.clientName && (
                  <span className="hidden sm:inline">| Client: {projectInfo.clientName}</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onSaveProjectJSON}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 shadow-sm"
              title="Export complete project backup file (.json)"
            >
              <FileDown size={14} className="text-slate-300" />
              <span className="hidden sm:inline">Backup JSON</span>
            </button>

            <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm">
              <FileUp size={14} className="text-slate-300" />
              <span className="hidden sm:inline">Load JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={onLoadProjectJSON}
                className="hidden"
              />
            </label>

            <button
              onClick={onResetProject}
              aria-label="Reset workspace"
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-950/50 hover:text-rose-300 text-slate-400 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
              title="Reset workspace"
            >
              <RotateCcw size={14} />
            </button>

            {/* Launch AI Render Button */}
            <button
              onClick={onOpenSummaryModal}
              disabled={isGenerating || viewsCount === 0}
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-emerald-950/50 flex items-center gap-2 ml-2 transform active:scale-95"
            >
              <Sparkles size={16} className="animate-pulse" />
              <span>{isGenerating ? 'Rendering...' : 'Analyze & Render AI Design'}</span>
            </button>
          </div>
        </div>

        {/* Expandable Project Info Form */}
        {isEditingInfo && (
          <div className="mt-3 p-4 bg-slate-950/80 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Project Name</label>
              <input
                type="text"
                value={projectInfo.name}
                onChange={e => setProjectInfo(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Project Type</label>
              <select
                value={projectInfo.projectType}
                onChange={e => setProjectInfo(prev => ({ ...prev, projectType: e.target.value as ProjectType }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                {PROJECT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Target Space Type</label>
              <select
                value={projectInfo.spaceType || 'Corridor / Hallway'}
                onChange={e => setProjectInfo(prev => ({ ...prev, spaceType: e.target.value as SpaceType }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500 font-semibold text-xs"
              >
                {SPACE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Room / Space Name</label>
              <input
                type="text"
                value={projectInfo.roomName}
                onChange={e => setProjectInfo(prev => ({ ...prev, roomName: e.target.value }))}
                placeholder="e.g. Corridor View A / Presidential Suite"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Client Name</label>
              <input
                type="text"
                value={projectInfo.clientName}
                onChange={e => setProjectInfo(prev => ({ ...prev, clientName: e.target.value }))}
                placeholder="Client / Hotel Group"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Lead Designer</label>
              <input
                type="text"
                value={projectInfo.designerName}
                onChange={e => setProjectInfo(prev => ({ ...prev, designerName: e.target.value }))}
                placeholder="Designer name"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Project Status</label>
              <select
                value={projectInfo.status}
                onChange={e => setProjectInfo(prev => ({ ...prev, status: e.target.value as any }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="Draft">Draft</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">Review</option>
                <option value="Approved">Approved</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-slate-400 mb-1 font-medium">Designer Project Notes</label>
              <input
                type="text"
                value={projectInfo.notes}
                onChange={e => setProjectInfo(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="General project notes or client requirements..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Workspace Tabs Bar */}
      <div className="bg-slate-950 border-t border-slate-800/80 px-4 sm:px-6 overflow-x-auto scrollbar-thin">
        <div className="max-w-7xl mx-auto flex items-center space-x-1 min-w-max py-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all duration-150 ${
                  isActive
                    ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700/80'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-emerald-400' : 'text-slate-500'} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
