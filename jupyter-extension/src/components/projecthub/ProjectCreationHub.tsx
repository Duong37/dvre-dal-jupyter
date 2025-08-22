import React, { useState, useEffect } from 'react';
import { useProjects, ProjectTemplate, TemplateField } from '../../hooks/useProjects';

type CreationMode = 'template'  | 'custom-builder' | 'custom';

interface ProjectCreationHubProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface CustomField {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
}

interface TemplateFormData {
  [key: string]: any;
}



// Reusable Field Input Component
interface FieldInputProps {
  field: TemplateField | { fieldName: string; fieldType: 'string' | 'number' | 'boolean' | 'array' | 'object'; isRequired?: boolean; defaultValue?: string };
  value: any;
  onChange: (value: any) => void;
  isReadonly?: boolean;
}



// Component for rendering individual field inputs
const FieldInput: React.FC<FieldInputProps> = ({ field, value, onChange, isReadonly = false }) => {
  const fieldType = field.fieldType;
  const fieldName = field.fieldName;

  // Determine if this field should be readonly
  const shouldBeReadonly = isReadonly || fieldName === 'type' || fieldName === 'roles' || fieldName === 'participants';

  const getFieldHint = () => {
    if (field.fieldName === 'roles') {
      return 'Available roles for this project type';
    }
    if (field.fieldName === 'type') {
      return 'Project type (read-only)';
    }
    if (field.fieldName === 'participants') {
      return 'Project participants (auto-managed)';
    }
    return null;
  };

  const renderInput = () => {
    if (fieldType === 'string') {
      // Use textarea for description/objective fields, input for others
      if (fieldName === 'objective' || fieldName === 'description') {
        return (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            readOnly={shouldBeReadonly}
            required={field.isRequired}
            rows={3}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--jp-border-color1)',
              borderRadius: '3px',
              background: shouldBeReadonly ? 'var(--jp-layout-color2)' : 'var(--jp-layout-color1)',
              color: 'var(--jp-ui-font-color1)',
              fontSize: '13px',
              resize: 'vertical'
            }}
          />
        );
      } else {
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            readOnly={shouldBeReadonly}
            required={field.isRequired}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--jp-border-color1)',
              borderRadius: '3px',
              background: shouldBeReadonly ? 'var(--jp-layout-color2)' : 'var(--jp-layout-color1)',
              color: 'var(--jp-ui-font-color1)',
              fontSize: '13px'
            }}
          />
        );
      }
    }

    if (fieldType === 'number') {
      return (
        <input
          type="number"
          value={value || 0}
          onChange={(e) => onChange(Number(e.target.value))}
          readOnly={shouldBeReadonly}
          required={field.isRequired}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid var(--jp-border-color1)',
            borderRadius: '3px',
            background: shouldBeReadonly ? 'var(--jp-layout-color2)' : 'var(--jp-layout-color1)',
            color: 'var(--jp-ui-font-color1)',
            fontSize: '13px'
          }}
        />
      );
    }

    if (fieldType === 'boolean') {
      return (
        <select
          value={value ? 'true' : 'false'}
          onChange={(e) => onChange(e.target.value === 'true')}
          disabled={shouldBeReadonly}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid var(--jp-border-color1)',
            borderRadius: '3px',
            background: shouldBeReadonly ? 'var(--jp-layout-color2)' : 'var(--jp-layout-color1)',
            color: 'var(--jp-ui-font-color1)',
            fontSize: '13px'
          }}
        >
          <option value="false">false</option>
          <option value="true">true</option>
        </select>
      );
    }

    if (fieldType === 'array') {
      const arrayValue = Array.isArray(value) ? value : [];

      if (shouldBeReadonly) {
        return (
          <div style={{
            padding: '8px 12px',
            border: '1px solid var(--jp-border-color1)',
            borderRadius: '3px',
            background: 'var(--jp-layout-color2)',
            color: 'var(--jp-ui-font-color1)',
            fontSize: '13px',
            minHeight: '40px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '5px',
            alignItems: 'center'
          }}>
            {arrayValue.length > 0 ? 
              arrayValue.map((item, index) => (
                <span key={index} style={{
                  background: 'var(--jp-brand-color3)',
                  color: 'var(--jp-ui-font-color1)',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  fontSize: '12px'
                }}>
                  {item}
                </span>
              )) : 
              <span style={{ color: 'var(--jp-ui-font-color3)', fontStyle: 'italic' }}>No items</span>
            }
          </div>
        );
      }

      return (
        <div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '5px',
            marginBottom: '8px',
            minHeight: '30px',
            padding: '8px',
            border: '1px solid var(--jp-border-color1)',
            borderRadius: '3px',
            background: 'var(--jp-layout-color1)'
          }}>
            {arrayValue.length > 0 ? 
              arrayValue.map((item, index) => (
                <span key={index} style={{
                  background: 'var(--jp-brand-color3)',
                  color: 'var(--jp-ui-font-color1)',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  {item}
                  <button
                    type="button"
                    onClick={() => {
                      const newArray = [...arrayValue];
                      newArray.splice(index, 1);
                      onChange(newArray);
                    }}
                    style={{
                      background: 'var(--jp-error-color1)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '2px',
                      width: '16px',
                      height: '16px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ×
                  </button>
                </span>
              )) : 
              <span style={{ color: 'var(--jp-ui-font-color3)', fontStyle: 'italic', fontSize: '12px' }}>
                No items added yet
              </span>
            }
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input
              type="text"
              placeholder="Add new item"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const newItem = (e.target as HTMLInputElement).value.trim();
                  if (newItem) {
                    onChange([...arrayValue, newItem]);
                    (e.target as HTMLInputElement).value = '';
                  }
                }
              }}
              style={{
                flex: 1,
                padding: '6px 8px',
                border: '1px solid var(--jp-border-color1)',
                borderRadius: '3px',
                background: 'var(--jp-layout-color1)',
                color: 'var(--jp-ui-font-color1)',
                fontSize: '12px'
              }}
            />
            <button
              type="button"
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                const newItem = input.value.trim();
                if (newItem) {
                  onChange([...arrayValue, newItem]);
                  input.value = '';
                }
              }}
              style={{
                padding: '6px 12px',
                background: 'var(--jp-accent-color1)',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Add
            </button>
          </div>
        </div>
      );
    }

    if (fieldType === 'object') {
      return (
        <textarea
          value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value || ''}
          onChange={(e) => {
            try {
              const objectValue = JSON.parse(e.target.value);
              onChange(objectValue);
            } catch {
              onChange(e.target.value);
            }
          }}
          readOnly={shouldBeReadonly}
          placeholder='{"key": "value"}'
          rows={4}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid var(--jp-border-color1)',
            borderRadius: '3px',
            background: shouldBeReadonly ? 'var(--jp-layout-color2)' : 'var(--jp-layout-color1)',
            color: 'var(--jp-ui-font-color1)',
            fontSize: '12px',
            fontFamily: 'monospace',
            resize: 'vertical'
          }}
        />
      );
    }

    // Fallback for unknown field types
    return (
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        readOnly={shouldBeReadonly}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid var(--jp-border-color1)',
          borderRadius: '3px',
          background: shouldBeReadonly ? 'var(--jp-layout-color2)' : 'var(--jp-layout-color1)',
          color: 'var(--jp-ui-font-color1)',
          fontSize: '13px'
        }}
      />
    );
  };

  return (
    <div style={{ marginBottom: field.fieldName ? '15px' : '0' }}>
      {field.fieldName && (
        <label style={{ 
          display: 'block', 
          marginBottom: '5px', 
          color: 'var(--jp-ui-font-color2)',
          fontWeight: field.isRequired ? 'bold' : 'normal'
        }}>
          {field.fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          {field.isRequired && ' *'}
        </label>
      )}
      
      {renderInput()}
      
      {getFieldHint() && (
        <small style={{ 
          color: 'var(--jp-ui-font-color3)', 
          fontSize: '11px', 
          marginTop: '5px', 
          display: 'block' 
        }}>
          {getFieldHint()}
        </small>
      )}
    </div>
  );
};

// Component for rendering template-based form fields
const TemplateForm: React.FC<{
  template: ProjectTemplate;
  onSubmit: (data: TemplateFormData) => void;
  loading: boolean;
}> = ({ template, onSubmit, loading }) => {
  const [formData, setFormData] = useState<TemplateFormData>({});

  // Initialize form with default values
  useEffect(() => {
    const initialData: TemplateFormData = {};
    template.fields.forEach(field => {
      if (field.fieldName === 'participants') return; // Skip participants field
      
      if (field.defaultValue) {
        try {
          if (field.fieldType === 'array' || field.fieldType === 'object') {
            initialData[field.fieldName] = JSON.parse(field.defaultValue);
          } else if (field.fieldType === 'boolean') {
            initialData[field.fieldName] = field.defaultValue === 'true';
          } else if (field.fieldType === 'number') {
            initialData[field.fieldName] = Number(field.defaultValue);
          } else {
            initialData[field.fieldName] = field.defaultValue;
          }
        } catch {
          initialData[field.fieldName] = field.defaultValue;
        }
      } else {
        if (field.fieldType === 'array') {
          initialData[field.fieldName] = [];
        } else if (field.fieldType === 'object') {
          initialData[field.fieldName] = {};
        } else if (field.fieldType === 'boolean') {
          initialData[field.fieldName] = false;
        } else if (field.fieldType === 'number') {
          initialData[field.fieldName] = 0;
        } else {
          initialData[field.fieldName] = '';
        }
      }
    });
    setFormData(initialData);
  }, [template]);

  const updateField = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const renderField = (field: TemplateField) => {
    // Skip participants field - it's auto-managed
    if (field.fieldName === 'participants') return null;

    const value = formData[field.fieldName] || '';

    return (
      <FieldInput
        key={field.fieldName}
        field={field}
        value={value}
        onChange={(newValue: any) => updateField(field.fieldName, newValue)}
        isReadonly={false}
      />
    );
  };

  return (
    <div style={{ overflow: 'auto', paddingRight: '10px' }}>
      <style>{`
        /* Custom scrollbar for webkit browsers */
        div::-webkit-scrollbar {
          width: 8px;
        }
        div::-webkit-scrollbar-track {
          background: var(--jp-layout-color2);
          border-radius: 4px;
        }
        div::-webkit-scrollbar-thumb {
          background: var(--jp-border-color2);
          border-radius: 4px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background: var(--jp-border-color1);
        }
      `}</style>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          {template.fields.map(renderField)}
        </div>
        
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 16px',
            background: 'var(--jp-brand-color1)',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Creating...' : 'Create Project'}
        </button>
      </form>
    </div>
  );
};

export const ProjectCreationHub: React.FC<ProjectCreationHubProps> = ({
  onBack,
  onSuccess
}) => {
  const [creationMode, setCreationMode] = useState<CreationMode>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const { 
    templates, 
    loading: templatesLoading, 
    error: projectError,
    createProjectFromTemplate,
    createCustomProject,
    loadTemplates
  } = useProjects();

  const [formData, setFormData] = useState({
    projectData: ''
  });
  
  const [customFields, setCustomFields] = useState<CustomField[]>([
    { key: 'project_id', value: '', type: 'string' },
    { key: 'objective', value: '', type: 'string' },
    { key: 'description', value: '', type: 'string' }
  ]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleTemplateFormSubmit = async (templateData: TemplateFormData) => {
    if (!selectedTemplate) {
      setError('No template selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build the project data object from the form data
      const projectData = { ...templateData };
      
      // Ensure required fields are present
      if (!projectData.project_id || !projectData.objective) {
        setError('Project ID and Objective are required');
        return;
      }

      // The createProjectFromTemplate function will handle adding the creator to participants
      const projectAddress = await createProjectFromTemplate(selectedTemplate.id, projectData);

      if (projectAddress) {
        alert(`Project created successfully!\nAddress: ${projectAddress}`);
        onSuccess();
      } else {
        setError('Failed to create project');
      }
    } catch (err: any) {
      console.error('Failed to create project:', err);
      setError(`Failed to create project: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomJSONCreate = async () => {
    if (!formData.projectData) {
      setError('Please provide project data');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const projectData = JSON.parse(formData.projectData);
      const projectAddress = await createCustomProject(projectData);

      if (projectAddress) {
        alert(`Custom project created successfully!\nAddress: ${projectAddress}`);
        onSuccess();
      } else {
        setError('Failed to create project');
      }
    } catch (err: any) {
      console.error('Failed to create custom project:', err);
      setError(`Failed to create project: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomBuilderCreate = async () => {
    setLoading(true);
    setError(null);

    try {
      const projectData: any = {};
      
      // Convert custom fields to project data
      customFields.forEach(field => {
        if (field.key && field.value !== '') {
          let value = field.value;
          
          // Type conversion
          if (field.type === 'number') {
            value = Number(field.value);
          } else if (field.type === 'boolean') {
            value = field.value === 'true' || field.value === true;
          } else if (field.type === 'array') {
            // Handle array type conversion
            if (Array.isArray(field.value)) {
              // Already an array from FieldInput component
              value = field.value;
            } else if (typeof field.value === 'string') {
              // String value - try to parse as JSON first, then fall back to CSV
              try {
                value = JSON.parse(field.value);
                if (!Array.isArray(value)) {
                  value = field.value.split(',').map((s: string) => s.trim());
                }
              } catch {
                value = field.value.split(',').map((s: string) => s.trim());
              }
            } else {
              // Other types - convert to array
              value = field.value ? [field.value] : [];
            }
          } else if (field.type === 'object') {
            // Handle object type conversion
            if (typeof field.value === 'object' && field.value !== null) {
              // Already an object from FieldInput component
              value = field.value;
            } else if (typeof field.value === 'string') {
              // String value - try to parse as JSON
              try {
                value = JSON.parse(field.value);
              } catch {
                value = field.value;
              }
            } else {
              value = field.value;
            }
          }
          
          projectData[field.key] = value;
        }
      });

      if (!projectData.project_id || !projectData.objective) {
        setError('Project ID and Objective are required');
        return;
      }

      // Check if user explicitly defined roles
      const hasRolesField = customFields.some(field => field.key === 'roles');
      if (!hasRolesField) {
        // User didn't define roles, don't set anything - let the backend handle defaults
        // The createCustomProject function will add ['Member'] as default
      }

      projectData.created_at = new Date().toISOString();
      const projectAddress = await createCustomProject(projectData);

      if (projectAddress) {
        alert(`Project created successfully!\nAddress: ${projectAddress}`);
        onSuccess();
      } else {
        setError('Failed to create project');
      }
    } catch (err: any) {
      console.error('Failed to create project:', err);
      setError(`Failed to create project: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addCustomField = () => {
    setCustomFields(prev => [...prev, { key: '', value: '', type: 'string' }]);
  };

  const removeCustomField = (index: number) => {
    setCustomFields(prev => prev.filter((_, i) => i !== index));
  };

  // Helper function to convert CustomField to TemplateField for consistent rendering
  const customFieldToTemplateField = (customField: CustomField, isRequired = false): TemplateField => {
    return {
      fieldName: customField.key,
      fieldType: customField.type,
      isRequired: isRequired || customField.key === 'project_id' || customField.key === 'objective',
      defaultValue: ''
    };
  };

  const updateCustomField = (index: number, field: Partial<CustomField>) => {
    setCustomFields(prev => 
      prev.map((f, i) => i === index ? { ...f, ...field } : f)
    );
  };

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'var(--jp-ui-font-family)',
      background: 'var(--jp-layout-color1)',
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ 
          fontSize: '1.3rem',
          color: 'var(--jp-ui-font-color1)',
          margin: 0
        }}>
          Create New Project
        </h2>
        <button
          onClick={onBack}
          style={{
            padding: '8px 16px',
            background: 'var(--jp-layout-color2)',
            border: '1px solid var(--jp-border-color1)',
            borderRadius: '3px',
            cursor: 'pointer',
            color: 'var(--jp-ui-font-color1)',
            fontSize: '13px'
          }}
        >
          ← Back
        </button>
      </div>

      {(error || projectError) && (
        <div style={{
          background: 'var(--jp-error-color3)',
          border: '1px solid var(--jp-error-color1)',
          borderRadius: '3px',
          padding: '12px',
          marginBottom: '20px',
          color: 'var(--jp-error-color1)'
        }}>
          {error || projectError}
        </div>
      )}

      {/* Creation Mode Selector */}
      <div style={{ marginBottom: '20px', flexShrink: 0 }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', color: 'var(--jp-ui-font-color1)' }}>
          Choose Creation Method
        </h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {(['template', 'custom-builder', 'custom'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setCreationMode(mode)}
              style={{
                padding: '8px 16px',
                background: creationMode === mode ? 'var(--jp-brand-color1)' : 'var(--jp-layout-color2)',
                color: creationMode === mode ? 'white' : 'var(--jp-ui-font-color1)',
                border: '1px solid var(--jp-border-color1)',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              {mode === 'template' ? 'From Template' : 
               mode === 'custom' ? 'Custom JSON' : 
               'Custom Builder'}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        paddingRight: '5px' // Space for scrollbar
      }}>

      {/* Template Creation */}
      {creationMode === 'template' && (
        <div style={{ background: 'var(--jp-layout-color2)', padding: '20px', borderRadius: '3px' }}>
          <h4 style={{ marginBottom: '15px', color: 'var(--jp-ui-font-color1)' }}>Create from Template</h4>
          {templatesLoading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--jp-ui-font-color2)' }}>
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--jp-ui-font-color2)' }}>
              No templates available
            </div>
          ) : !selectedTemplate ? (
            <div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '10px', color: 'var(--jp-ui-font-color2)' }}>
                  Select Template
                </label>
                <div style={{ 
                  display: 'grid', 
                  gap: '10px', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                  paddingRight: '10px'
                }}>
                  {templates.map(template => (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      style={{
                        padding: '12px',
                        border: '1px solid var(--jp-border-color1)',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        background: 'var(--jp-layout-color1)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--jp-brand-color1)';
                        e.currentTarget.style.background = 'var(--jp-brand-color3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--jp-border-color1)';
                        e.currentTarget.style.background = 'var(--jp-layout-color1)';
                      }}
                    >
                      <h5 style={{ margin: '0 0 5px 0', color: 'var(--jp-ui-font-color1)' }}>{template.name}</h5>
                      <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: 'var(--jp-ui-font-color2)' }}>
                        {template.description}
                      </p>
                      <small style={{ color: 'var(--jp-ui-font-color3)' }}>
                        Type: {template.projectType}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '20px',
                padding: '10px',
                background: 'var(--jp-layout-color1)',
                borderRadius: '3px'
              }}>
                <div>
                  <h5 style={{ margin: '0 0 5px 0', color: 'var(--jp-ui-font-color1)' }}>
                    {selectedTemplate.name}
                  </h5>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--jp-ui-font-color2)' }}>
                    {selectedTemplate.description}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  style={{
                    padding: '5px 10px',
                    background: 'var(--jp-layout-color2)',
                    border: '1px solid var(--jp-border-color1)',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: 'var(--jp-ui-font-color1)'
                  }}
                >
                  Change Template
                </button>
              </div>
              
              <TemplateForm
                template={selectedTemplate}
                onSubmit={handleTemplateFormSubmit}
                loading={loading}
              />
            </div>
          )}
        </div>
      )}

      {/* Custom Builder */}
      {creationMode === 'custom-builder' && (
        <div style={{ background: 'var(--jp-layout-color2)', padding: '20px', borderRadius: '3px' }}>
          <h4 style={{ marginBottom: '15px', color: 'var(--jp-ui-font-color1)' }}>Custom Project Builder</h4>
          <div style={{ 
            paddingRight: '10px',
            display: 'flex', 
            flexDirection: 'column', 
            gap: '15px' 
          }}>
            {customFields.map((field, index) => (
              <div key={index} style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 120px 2fr auto', 
                gap: '12px', 
                alignItems: 'start',
                padding: '8px 0',
                borderBottom: index < customFields.length - 1 ? '1px solid var(--jp-border-color2)' : 'none'
              }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '5px', 
                    color: 'var(--jp-ui-font-color2)', 
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    Field Name
                  </label>
                  <input
                    type="text"
                    value={field.key}
                    onChange={(e) => updateCustomField(index, { key: e.target.value })}
                    placeholder="e.g., title, tags, etc."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid var(--jp-border-color1)',
                      borderRadius: '3px',
                      background: 'var(--jp-layout-color1)',
                      color: 'var(--jp-ui-font-color1)',
                      fontSize: '12px',
                      transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--jp-brand-color1)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--jp-border-color1)'}
                  />
                </div>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '5px', 
                    color: 'var(--jp-ui-font-color2)', 
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    Type
                  </label>
                  <select
                    value={field.type}
                    onChange={(e) => updateCustomField(index, { type: e.target.value as any })}
                    style={{
                      width: '100%',
                      padding: '8px 6px',
                      border: '1px solid var(--jp-border-color1)',
                      borderRadius: '3px',
                      background: 'var(--jp-layout-color1)',
                      color: 'var(--jp-ui-font-color1)',
                      fontSize: '12px',
                      transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--jp-brand-color1)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--jp-border-color1)'}
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="array">Array</option>
                    <option value="object">Object</option>
                  </select>
                </div>
                <div style={{ minWidth: '0' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '5px', 
                    color: 'var(--jp-ui-font-color2)', 
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    Value
                  </label>
                  <div style={{ width: '100%' }}>
                    <FieldInput
                      field={{...customFieldToTemplateField(field), fieldName: ''}}
                      value={field.value}
                      onChange={(newValue: any) => updateCustomField(index, { value: newValue })}
                      isReadonly={false}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '20px' }}>
                  <button
                    onClick={() => removeCustomField(index)}
                    disabled={customFields.length <= 1}
                    title={customFields.length <= 1 ? "Cannot remove the last field" : "Remove this field"}
                    style={{
                      padding: '8px 10px',
                      background: customFields.length <= 1 ? 'var(--jp-layout-color3)' : 'var(--jp-error-color1)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: customFields.length <= 1 ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      opacity: customFields.length <= 1 ? 0.5 : 1,
                      minWidth: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (customFields.length > 1) {
                        e.currentTarget.style.background = 'var(--jp-error-color0)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (customFields.length > 1) {
                        e.currentTarget.style.background = 'var(--jp-error-color1)';
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={addCustomField}
                style={{
                  padding: '8px 12px',
                  background: 'var(--jp-accent-color1)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                + Add Field
              </button>
              
              <button
                onClick={handleCustomBuilderCreate}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  background: 'var(--jp-brand-color1)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? 'Creating...' : 'Create Custom Project'}
              </button>
            </div>
          </div>
        </div>
      )}

       {/* Custom JSON Creation */}
      {creationMode === 'custom' && (
        <div style={{ background: 'var(--jp-layout-color2)', padding: '20px', borderRadius: '3px' }}>
          <h4 style={{ marginBottom: '15px', color: 'var(--jp-ui-font-color1)' }}>Custom JSON Project</h4>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: 'var(--jp-ui-font-color2)' }}>
              Project Data (JSON) *
            </label>
            <textarea
              value={formData.projectData}
              onChange={(e) => setFormData(prev => ({ ...prev, projectData: e.target.value }))}
              placeholder={JSON.stringify({
                project_id: "my-project",
                objective: "Research collaboration",
                description: "A collaborative research project",
                type: "research",
                roles: ["member", "contributor", "reviewer"]
              }, null, 2)}
              rows={12}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--jp-border-color1)',
                borderRadius: '3px',
                background: 'var(--jp-layout-color1)',
                color: 'var(--jp-ui-font-color1)',
                fontSize: '12px',
                fontFamily: 'monospace',
                resize: 'vertical',
              }}
            />
            <button
              onClick={handleCustomJSONCreate}
              disabled={loading}
              style={{
                marginTop: '10px',
                padding: '10px 16px',
                background: 'var(--jp-brand-color1)',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Creating...' : 'Create Custom Project'}
            </button>
          </div>
        </div>
      )}

      
      </div> {/* End of scrollable content area */}
    </div>
  );
};

export default ProjectCreationHub;
