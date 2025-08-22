import React, { useState } from "react";

export default function UserMetadataForm({
  onRegister,
}: {
  onRegister: (email: string, name: string, institution: string) => Promise<void>;
}) {
  const [form, setForm] = useState({ email: "", name: "", institution: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onRegister(form.email, form.name, form.institution);
    setLoading(false);
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        backgroundColor: 'var(--jp-layout-color1)',
        padding: '8px',
        borderRadius: '4px',
        border: '1px solid var(--jp-border-color1)'
      }}
    >
      <p style={{ fontWeight: 'bold', margin: 0 }}>Register your metadata:</p>
      <input
        type="email"
        placeholder="Email"
        value={form.email}
        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        required
        style={{
          padding: '4px',
          border: '1px solid var(--jp-border-color1)',
          borderRadius: '4px',
          backgroundColor: 'var(--jp-input-background)',
          color: 'var(--jp-ui-font-color1)'
        }}
      />
      <input
        type="text"
        placeholder="Name"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        required
        style={{
          padding: '4px',
          border: '1px solid var(--jp-border-color1)',
          borderRadius: '4px',
          backgroundColor: 'var(--jp-input-background)',
          color: 'var(--jp-ui-font-color1)'
        }}
      />
      <input
        type="text"
        placeholder="Institution"
        value={form.institution}
        onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
        required
        style={{
          padding: '4px',
          border: '1px solid var(--jp-border-color1)',
          borderRadius: '4px',
          backgroundColor: 'var(--jp-input-background)',
          color: 'var(--jp-ui-font-color1)'
        }}
      />
      <button
        type="submit"
        style={{
          borderRadius: '4px',
          cursor: 'pointer',
          padding: '8px',
          transition: 'opacity 0.2s',
          backgroundColor: 'var(--jp-brand-color1)',
          color: 'var(--jp-ui-inverse-font-color1)',
          border: 'none',
          opacity: loading ? 0.75 : 1
        }}
        disabled={loading}
        onMouseEnter={(e) => !loading && (e.currentTarget.style.opacity = '0.75')}
        onMouseLeave={(e) => !loading && (e.currentTarget.style.opacity = '1')}
      >
        {loading ? "Registering..." : "Register"}
      </button>
    </form>
  );
}
