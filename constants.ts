import {
  StyleDirection,
  ViewCategory,
  ReferenceCategory,
  GenerationMode,
  ProjectType,
  SpaceType,
  StructuredPrompt,
  PreservationControls
} from './types';

export const SPACE_TYPES: SpaceType[] = [
  'Corridor / Hallway',
  'Outdoor Space / Landscape',
  'Guest Room / Bedroom',
  'Hotel Suite',
  'Lobby & Reception',
  'Facade & Exterior',
  'Terrace, Balcony & Deck',
  'Garden & Courtyard',
  'Patio & Outdoor Lounge',
  'Dining Room & Restaurant',
  'Living Room / Lounge',
  'Office & Workspace',
  'Spa, Pool & Wellness',
  'Bathroom & Powder Room',
  'Kitchen & Pantry',
  'Custom Space'
];

export const VIEW_CATEGORIES: ViewCategory[] = [
  'Front View',
  'Left View',
  'Right View',
  'Rear View',
  'Ceiling / Sky',
  'Floor / Ground',
  'Entrance / Portal',
  'Outdoor Perspective',
  'Facade View',
  'Landscape Details',
  'Furniture Close-up',
  'Lighting Details',
  'Decorative Details',
  'Additional Images'
];

export const REFERENCE_CATEGORIES: ReferenceCategory[] = [
  'Inspiration Images',
  'Mood Boards',
  'Hotel References',
  'Material Samples',
  'Furniture References',
  'Lighting Inspiration',
  'Branding Assets'
];

export const PROJECT_TYPES: ProjectType[] = [
  'Hotel',
  'Villa',
  'Restaurant',
  'Office',
  'Spa',
  'Luxury Residential',
  'Commercial'
];

export const GENERATION_MODES: { id: GenerationMode; title: string; description: string; iconName: string }[] = [
  {
    id: 'quick_edit',
    title: 'Quick Edit',
    description: 'Fast local adjustments or targeted object additions and removals.',
    iconName: 'Zap'
  },
  {
    id: 'professional_design',
    title: 'Professional Design',
    description: 'Balanced studio render blending existing architecture with new FF&E concept.',
    iconName: 'Sparkles'
  },
  {
    id: 'luxury_upgrade',
    title: 'Luxury Upgrade',
    description: 'Elevate room with 5-star hospitality materials, cove LED lighting, and bespoke brass trim.',
    iconName: 'Crown'
  },
  {
    id: 'materials_only',
    title: 'Materials Only',
    description: 'Swaps wall cladding, travertine, marble, carpet, or wood veneers while keeping furniture layout.',
    iconName: 'Layers'
  },
  {
    id: 'furniture_only',
    title: 'Furniture Only',
    description: 'Replaces sofas, tables, credenzas, or loose accent furniture pieces while preserving structural shell.',
    iconName: 'Armchair'
  },
  {
    id: 'lighting_only',
    title: 'Lighting Only',
    description: 'Modifies architectural lighting, wall sconces, pendants, color temperature (2700K), and shadows.',
    iconName: 'Lightbulb'
  },
  {
    id: 'hotel_branding',
    title: 'Hotel Branding',
    description: 'Applies corporate brand identity, custom wall art, signature color palettes, and hotel signage.',
    iconName: 'Building'
  },
  {
    id: 'complete_redesign',
    title: 'Complete Redesign',
    description: 'Total structural and aesthetic interior makeover based on structured prompt parameters.',
    iconName: 'RefreshCw'
  },
  {
    id: 'ultra_photorealistic',
    title: 'Ultra Photorealistic',
    description: 'Multi-pass 2K render pass focused on photorealistic depth, subsurface scattering, and ray-traced reflections.',
    iconName: 'Aperture'
  }
];

export const DEFAULT_STRUCTURED_PROMPT: StructuredPrompt = {
  projectGoal: 'Redesign luxury hotel suite and corridor for high-end hospitality standards',
  interiorStyle: 'Modern Mediterranean Luxury',
  materials: 'Honed Italian Travertine, Fluted Dark Walnut, Brushed Champagne Brass, Natural Bouclé Upholstery',
  colors: 'Warm Ivory, Terracotta, Muted Sage, Champagne Gold accents',
  lighting: 'Warm 2700K indirect cove LED, ambient alabaster wall sconces, subtle spotlighting on artwork',
  furnitureStyle: 'Bespoke Italian curved seating, low-profile minimalist credenza, organic stone coffee table',
  decorativeStyle: 'Sculptural ceramic vases, gallery wall with architectural sketches, acoustic textured wall panels',
  mood: 'Serene, prestigious, warm, and inviting luxury hospitality atmosphere',
  architecturalConstraints: 'Structural columns and primary door frames cannot be moved. Maintain ceiling height 3.2m.',
  elementsToPreserveText: 'Keep main entrance doorway arch and exterior window frame geometry.',
  elementsToReplaceText: 'Replace existing worn carpet with travertine flooring and custom woven runner.',
  brandGuidelines: 'Exemplify 5-star boutique luxury hotel standards with subtle tactile sophistication.',
  additionalInstructions: 'Ensure realistic natural sunlight filtering through windows with soft shadows.'
};

export const DEFAULT_PRESERVATION_CONTROLS: PreservationControls = {
  walls: false,
  flooring: false,
  ceilings: false,
  windows: true,
  doors: true,
  lighting: false,
  artwork: false,
  sofas: false,
  tables: false,
  curtains: false,
  columns: true,
  structuralElements: true
};

// Curated starting points, used as (a) tappable inspiration chips in Studio,
// where they pre-fill the free-text style field but never gate what a user
// can type, and (b) as one of the structured preset options in Pro Studio.
export const STYLE_DIRECTIONS: StyleDirection[] = [
  {
    id: 'mediterranean',
    title: 'Modern Mediterranean Luxury',
    description: [
      'Warm neutral tones and honed stone',
      'Natural travertine or micro-cement textures',
      'Soft indirect cove lighting',
      'Relaxed yet high-end architectural atmosphere'
    ]
  },
  {
    id: 'tunisian',
    title: 'Contemporary Tunisian Elegance',
    description: [
      'Subtle North African geometry and archways',
      'Refined carved plaster and zellige accents',
      'Warm brass and beaten copper details',
      'Cultural luxury balanced with modern minimalism'
    ]
  },
  {
    id: 'minimal',
    title: 'High-End Minimal Modern',
    description: [
      'Clean architectural lines and shadow gaps',
      'Premium dark walnut and polished concrete',
      'Concealed frameless doors and recessed fixtures',
      'Serene, uncluttered spatial luxury'
    ]
  },
  {
    id: 'boutique',
    title: 'Boutique Hotel Artistic Style',
    description: [
      'Custom textured wall panels and fluted woodwork',
      'Sculptural statement pendants and alabaster sconces',
      'Artistic carpet runners and curated gallery walls',
      'Unique, memorable guest experience design'
    ]
  },
  {
    id: 'classic',
    title: 'Timeless Classic Luxury',
    description: [
      'Rich boiserie wood paneling and wainscoting',
      'Marble or herringbone hardwood flooring',
      'Warm classic crystal lighting and bronze trim',
      'Prestigious, enduring 5-star grand hotel feel'
    ]
  },
  {
    id: 'japandi',
    title: 'Japandi Hospitality Sanctuary',
    description: [
      'Light oak slatted screens and paper sconces',
      'Low-slung organic furniture in neutral linen',
      'Tactile lime wash plaster walls',
      'Calming biophilic elements and minimalist harmony'
    ]
  }
];

/**
 * Studio no longer forces a fixed set of styles onto every render. A user
 * enters (or picks, as a starting point) exactly ONE style direction, and
 * the app explores it from 5 different creative angles so they still get a
 * spread of concepts to compare — just all faithful to the style they chose,
 * instead of 5 unrelated preset aesthetics they didn't ask for.
 */
export interface StyleVariationAngle {
  id: string;
  label: string;
  brief: string;
}

export const STYLE_VARIATION_ANGLES: StyleVariationAngle[] = [
  {
    id: 'signature',
    label: 'Signature Layout',
    brief: 'The definitive, best-foot-forward interpretation of the style — balanced composition, safest and most broadly appealing furniture arrangement.',
  },
  {
    id: 'bold-material',
    label: 'Bold Material Accent',
    brief: 'Same style direction, but push one hero material or texture further than usual (a bolder stone vein, a richer wood tone, a more tactile fabric) as the visual anchor.',
  },
  {
    id: 'lighting-mood',
    label: 'Alternate Lighting Mood',
    brief: 'Same style and furniture language, reinterpreted under a different lighting mood (e.g. moodier and more dramatic, or brighter and more airy) to show a different time-of-day feel.',
  },
  {
    id: 'layout-variation',
    label: 'Alternate Spatial Layout',
    brief: 'Same style, but rearrange the furniture/zoning within the space (different traffic flow, seating configuration, or focal wall) while keeping every material and finish choice consistent.',
  },
  {
    id: 'artful-detail',
    label: 'Art & Styling Focus',
    brief: 'Same style, with extra attention to decorative styling — artwork, accessories, greenery, and finishing touches — as the point of difference rather than structure or materials.',
  },
];

export interface DesignBrain {
  id: string;
  title: string;
  description: string;
  iconName: string;
  /** Appended to the system role so this expert lens shapes every render. */
  expertise: string;
}

/**
 * "Brains" are swappable expert lenses layered on top of whatever generation
 * mode and style are chosen — each one biases the AI's design judgement
 * (what it prioritizes, what vocabulary it reaches for) toward a different
 * kind of hospitality project, without changing the underlying workflow.
 */
export const DESIGN_BRAINS: DesignBrain[] = [
  {
    id: 'luxury-hospitality',
    title: 'Luxury Hospitality Architect',
    description: 'The default lens: 5-star international hotel and resort design standards.',
    iconName: 'Crown',
    expertise: 'Prioritize 5-star international hospitality standards: premium natural materials, generous proportions, and finishes that photograph well for brochures and OTA listings.',
  },
  {
    id: 'boutique-art',
    title: 'Boutique Art Director',
    description: 'Independent, characterful boutique hotels — design as storytelling.',
    iconName: 'Palette',
    expertise: 'Prioritize a distinctive, story-driven aesthetic over corporate polish: bespoke art, unexpected color and pattern combinations, and a strong sense of place unique to this property, in the spirit of a boutique/lifestyle hotel brand.',
  },
  {
    id: 'sustainable-biophilic',
    title: 'Sustainable & Biophilic Specialist',
    description: 'Eco-conscious materials, natural light, and greenery-forward design.',
    iconName: 'Leaf',
    expertise: 'Prioritize sustainable, low-impact materials (reclaimed wood, natural fiber, low-VOC finishes), abundant natural light, and biophilic elements like planting and natural textures, without sacrificing a luxury feel.',
  },
  {
    id: 'resort-wellness',
    title: 'Resort & Wellness Designer',
    description: 'Spas, pools, and resort spaces built around calm and recovery.',
    iconName: 'Waves',
    expertise: 'Prioritize a calming, restorative atmosphere suited to spa/wellness/resort spaces: soft natural palettes, water and stone textures, indirect ambient lighting, and layouts that feel spacious and unhurried.',
  },
  {
    id: 'heritage-restoration',
    title: 'Heritage & Restoration Expert',
    description: 'Historic properties — modernize while respecting original character.',
    iconName: 'Landmark',
    expertise: 'Prioritize respecting and restoring original architectural character (period moldings, heritage materials, historic proportions) while tastefully integrating modern comfort and building services.',
  },
];

export const SYSTEM_ROLE = `
You are a world-class interior designer, architectural visualization expert, and hospitality brand consultant.
You excel in designing hotels, villas, restaurants, offices, spas, and luxury residential projects.
You understand architectural geometry, guest circulation psychology, luxury material realism, lighting physics, and brand guidelines.
All generated designs must be photorealistic, buildable, presentation-ready, and strictly follow the user's multi-view spatial instructions and preservation controls.
`;

export const ARCHITECTURAL_CONSTRAINTS = `
ARCHITECTURAL & PRESERVATION RULES:
1. Maintain consistent structural camera perspectives, door placements, and room proportions across views.
2. Strictly enforce all active element preservation checkboxes (e.g. if windows or structural columns are set to be preserved, do NOT modify or obscure them).
3. Ensure materials, textures, lighting temperature (e.g. 2700K), and color palette seamlessly match across all room views.
`;

export const EDIT_SYSTEM_ROLE = `
You are a professional AI interior architecture editing engine.
You edit target room photographs or renders based on precise instructions, preserving unedited areas while seamlessly integrating new materials, furniture, lighting, or wall finishes.
`;
