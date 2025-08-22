import React from "react";

export default function UserMetadataDisplay({
  metadata,
}: {
  metadata: { email: string; name: string; institution: string };
}) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <p style={{ fontWeight: "bold", color: "var(--jp-ui-font-color1)" }}>Your Metadata:</p>
      <ul style={{ 
        backgroundColor: "var(--jp-layout-color2)", 
        padding: "8px", 
        borderRadius: "4px", 
        border: "1px solid var(--jp-border-color1)",
        listStyle: "none",
        margin: 0
      }}>
        <li style={{ color: "var(--jp-ui-font-color1)" }}>
          <span style={{ fontWeight: "600" }}>Email:</span> {metadata.email}
        </li>
        <li style={{ color: "var(--jp-ui-font-color1)" }}>
          <span style={{ fontWeight: "600" }}>Name:</span> {metadata.name}
        </li>
        <li style={{ color: "var(--jp-ui-font-color1)" }}>
          <span style={{ fontWeight: "600" }}>Institution:</span> {metadata.institution}
        </li>
      </ul>
    </div>
  );
}
