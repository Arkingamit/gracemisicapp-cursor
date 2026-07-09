import React, { useState, useRef } from 'react';
import { GripVertical, Plus, Trash2, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ANNOTATION_COLOR_PRESETS } from '@/lib/songEditTypes';

interface Annotation {
  id: string;
  text: string;
  color?: string;
}

/** Locally-controlled annotation input with inline color picker */
const AnnotationInput: React.FC<{
  annotation: Annotation;
  fontSize?: number;
  onEdit: (id: string, text: string) => void;
  onColorChange: (id: string, color: string) => void;
  onDelete: (id: string) => void;
}> = ({ annotation, fontSize = 16, onEdit, onColorChange, onDelete }) => {
  const [localValue, setLocalValue] = useState(annotation.text);
  const [showColors, setShowColors] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeColor = annotation.color || '#a855f7';

  const commit = () => {
    if (localValue !== annotation.text) {
      onEdit(annotation.id, localValue);
    }
  };

  return (
    <div className="flex items-center gap-1 group/ann">
      {/* Color picker toggle */}
      <button
        className="shrink-0 w-4 h-4 rounded-full border border-white/20 transition-transform hover:scale-125"
        style={{ backgroundColor: activeColor }}
        onClick={() => setShowColors(!showColors)}
        title="Change note color"
      />

      {/* Color palette (inline, shows on click) */}
      {showColors && (
        <div className="flex items-center gap-0.5 px-1 py-0.5 bg-secondary/80 rounded-md">
          {ANNOTATION_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.value}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-transform hover:scale-125 ${
                activeColor === preset.value ? 'border-white ring-2 ring-offset-1 ring-offset-black ring-primary scale-125' : 'border-white/20'
              }`}
              style={{ backgroundColor: preset.value }}
              onClick={() => {
                onColorChange(annotation.id, preset.value);
                setShowColors(false);
              }}
              title={preset.label}
            />
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        className="annotation-input flex-1"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            inputRef.current?.blur();
          }
        }}
        placeholder="Add a note (e.g., Repeat 2x, Guitar solo)…"
        style={{ color: activeColor, fontSize: `${fontSize * 0.85}px` }}
      />
      <button
        className="opacity-100 p-0.5 hover:text-red-500 text-muted-foreground transition-colors"
        onClick={() => onDelete(annotation.id)}
        title="Remove annotation"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
};

interface EditableSectionProps {
  sectionIndex: number;
  label: string;
  children: React.ReactNode;
  annotations: Annotation[];
  hidden: boolean;
  onLabelEdit: (newLabel: string) => void;
  onAddAnnotation: () => void;
  onEditAnnotation: (annotationId: string, text: string) => void;
  onAnnotationColorChange: (annotationId: string, color: string) => void;
  onDeleteAnnotation: (annotationId: string) => void;
  onToggleHide: () => void;
  fontSize?: number;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDropTarget: boolean;
}

const EditableSection: React.FC<EditableSectionProps> = ({
  sectionIndex,
  label,
  children,
  annotations,
  hidden,
  onLabelEdit,
  onAddAnnotation,
  onEditAnnotation,
  onAnnotationColorChange,
  onDeleteAnnotation,
  onToggleHide,
  fontSize = 16,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
  isDropTarget,
}) => {
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(label);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const handleLabelClick = () => {
    setEditingLabel(true);
    setLabelValue(label);
    setTimeout(() => labelInputRef.current?.select(), 10);
  };

  const handleLabelSubmit = () => {
    setEditingLabel(false);
    if (labelValue.trim() && labelValue.trim() !== label) {
      onLabelEdit(labelValue.trim());
    }
  };

  return (
    <div
      className={`section-wrapper relative group rounded-lg transition-all duration-200 ${
        isDragging ? 'section-dragging' : ''
      } ${isDropTarget ? 'section-drop-target' : ''} ${
        hidden ? 'opacity-40 grayscale' : ''
      }`}
      draggable
      onDragStart={(e) => onDragStart(e, sectionIndex)}
      onDragOver={(e) => onDragOver(e, sectionIndex)}
      onDragEnd={onDragEnd}
    >
      {/* Section header bar */}
      <div className="flex items-center gap-2 mb-2">
        {/* Drag handle */}
        <div className="drag-handle flex-shrink-0 p-0.5 rounded hover:bg-secondary">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Section label — click to edit */}
        {editingLabel ? (
          <input
            ref={labelInputRef}
            className="editing-lyric text-xs font-bold uppercase tracking-wider bg-transparent border-none py-0.5 px-1"
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            onBlur={handleLabelSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLabelSubmit();
              if (e.key === 'Escape') setEditingLabel(false);
            }}
            autoFocus
          />
        ) : (
          <span
            className="section-label-editable text-xs font-bold uppercase tracking-wider text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded"
            onClick={handleLabelClick}
            title="Click to rename section"
          >
            {label}
          </span>
        )}

        {/* Section action buttons — always visible */}
        <div className="flex items-center gap-0.5 opacity-100 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onAddAnnotation}
            title="Add annotation"
          >
            <MessageSquarePlus className="h-3 w-3 text-purple-500" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onToggleHide}
            title={hidden ? 'Show section' : 'Hide from export'}
          >
            {hidden ? (
              <Plus className="h-3 w-3 text-green-500" />
            ) : (
              <Trash2 className="h-3 w-3 text-red-400" />
            )}
          </Button>
        </div>
      </div>

      {/* Annotations above content */}
      {annotations.map((ann) => (
        <AnnotationInput
          key={ann.id}
          annotation={ann}
          fontSize={fontSize}
          onEdit={onEditAnnotation}
          onColorChange={onAnnotationColorChange}
          onDelete={onDeleteAnnotation}
        />
      ))}

      {/* Section content (chord/lyric lines) */}
      <div className={hidden ? 'pointer-events-none select-none' : ''}>
        {children}
      </div>
    </div>
  );
};

export default EditableSection;
