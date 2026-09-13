export type ViewCategory =
  | 'Front View'
  | 'Left View'
  | 'Right View'
  | 'Rear View'
  | 'Ceiling / Sky'
  | 'Floor / Ground'
  | 'Entrance / Portal'
  | 'Outdoor Perspective'
  | 'Facade View'
  | 'Landscape Details'
  | 'Furniture Close-up'
  | 'Lighting Details'
  | 'Decorative Details'
  | 'Additional Images';

export type PriorityLevel = 'high' | 'medium' | 'low';

export type SpaceType =
  | 'Corridor / Hallway'
  | 'Outdoor Space / Landscape'
  | 'Guest Room / Bedroom'
  | 'Hotel Suite'
  | 'Lobby & Reception'
  | 'Facade & Exterior'
  | 'Terrace, Balcony & Deck'
  | 'Garden & Courtyard'
  | 'Patio & Outdoor Lounge'
  | 'Dining Room & Restaurant'
  | 'Living Room / Lounge'
  | 'Office & Workspace'
  | 'Spa, Pool & Wellness'
  | 'Bathroom & Powder Room'
  | 'Kitchen & Pantry'
  | string;

export interface FileData {
  id: string;
  url: string;
  file: File;
  base64: string;
  name?: string;
  size?: number;
  type?: string;
}

export interface ViewImage {
  id: string;
  title: string;
  category: ViewCategory;
  fileData: FileData;
  customPrompt: string;
  priority: PriorityLevel;
  notes: string;
  linkedReferenceId?: string;
  order: number;
}

export type ReferenceCategory =
  | 'Inspiration Images'
  | 'Mood Boards'
  | 'Hotel References'
  | 'Material Samples'
  | 'Furniture References'
  | 'Lighting Inspiration'
  | 'Branding Assets';

export interface ReferenceImage {
  id: string;
  title: string;
  category: ReferenceCategory;
  fileData: FileData;
  notes: string;
}

export type DocType = 'floor_plan' | 'cad_drawing' | 'pdf' | 'sketch' | 'measurement_sheet';

export interface ArchitecturalDoc {
  id: string;
  title: string;
  type: DocType;
  fileData: FileData;
  notes: string;
}

export interface RoomMeasurements {
  length: string;
  width: string;
  height: string;
  unit: 'meters' | 'feet';
  totalArea: string;
  specialFeatures: string;
}

export interface StructuredPrompt {
  projectGoal: string;
  interiorStyle: string;
  materials: string;
  colors: string;
  lighting: string;
  furnitureStyle: string;
  decorativeStyle: string;
  mood: string;
  architecturalConstraints: string;
  elementsToPreserveText: string;
  elementsToReplaceText: string;
  brandGuidelines: string;
  additionalInstructions: string;
}

export interface PreservationControls {
  walls: boolean;
  flooring: boolean;
  ceilings: boolean;
  windows: boolean;
  doors: boolean;
  lighting: boolean;
  artwork: boolean;
  sofas: boolean;
  tables: boolean;
  curtains: boolean;
  columns: boolean;
  structuralElements: boolean;
}

export type GenerationMode =
  | 'quick_edit'
  | 'professional_design'
  | 'luxury_upgrade'
  | 'materials_only'
  | 'furniture_only'
  | 'lighting_only'
  | 'hotel_branding'
  | 'complete_redesign'
  | 'ultra_photorealistic';

export type ProjectType =
  | 'Hotel'
  | 'Villa'
  | 'Restaurant'
  | 'Office'
  | 'Spa'
  | 'Luxury Residential'
  | 'Commercial';

export interface ProjectInfo {
  id?: string;
  name: string;
  projectType: ProjectType | string;
  spaceType: SpaceType;
  roomName: string;
  clientName: string;
  designerName: string;
  status: 'Draft' | 'In Progress' | 'Review' | 'Approved' | 'Completed';
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AIAnalysisResult {
  confidenceScore: number;
  detectedRoomType: string;
  spatialGeometry: string;
  lightingConditions: string;
  primaryMaterials: string[];
  keyArchitecturalFeatures: string[];
  viewCoverageStatus: string;
  designRecommendations: string[];
  readinessChecklist: { item: string; status: 'pass' | 'warning' | 'info' }[];
}

export interface GeneratedResultView {
  id: string;
  viewId?: string;
  viewTitle: string;
  category?: ViewCategory;
  imageUrl: string;
  promptUsed: string;
  timestamp: string;
}

export interface ProjectVersion {
  id: string;
  versionNumber: number;
  timestamp: string;
  generatedImageUrl: string;
  originalViewUrl: string;
  viewTitle: string;
  structuredPrompt: StructuredPrompt;
  preservationControls: PreservationControls;
  generationMode: GenerationMode;
  promptUsed: string;
}

export interface StyleDirection {
  id: string;
  title: string;
  description: string[];
}

export interface GeneratedDesign {
  id: string;
  styleId: string;
  styleTitle: string;
  imageUrl: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

export interface DesignSession {
  id: string;
  date: string;
  prompt: string;
  originalImage: string;
  designs: GeneratedDesign[];
  mode?: 'remodel' | 'prompt_only';
}
