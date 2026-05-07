export interface Thought {
  id: string;
  content: string;
  mood: string;
  mood_color: string;
  felt_count?: number;
  is_crisis: boolean;
  created_at: string;
  expires_at: string;
  position_x: number;
  position_y: number;
  rotation: number;
  opacity_level: number;
}
