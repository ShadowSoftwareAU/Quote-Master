import { Canvas } from "@react-three/fiber";
import { Bounds, Edges, Grid, Html, OrbitControls } from "@react-three/drei";
import type {
  CadLayoutPayload,
  CadStructuralComponent,
} from "@workspace/api-client-react";
import type { CadComplianceResult } from "@/lib/cad-compliance";
import { useState } from "react";

const COLORS = {
  carpentry: {
    beam: "#8B5A2B",
    post: "#6B4423",
    joist: "#CD853F",
    wall: "#D6B98C",
    "decking-board": "#DEB887",
    handrail: "#A0522D",
  },
  plumbing: {
    pipe: "#A9A9A9",
    fitting: "#808080",
    fixture: "#E0E0E0",
  },
  electrical: {
    conduit: "#FF8C00",
    cable: "#4682B4",
    outlet: "#F4F4F5",
    "junction-box": "#D3D3D3",
    fixture: "#FDF5E6",
  },
  warning: "#E11D48",
  highlight: "#2463EB",
};

function getLinearGeometry(component: CadStructuralComponent) {
  const { dimensions } = component;
  const axes = [
    { axis: "x", length: dimensions.x },
    { axis: "y", length: dimensions.y },
    { axis: "z", length: dimensions.z },
  ] as const;
  const longest = axes.reduce((current, candidate) =>
    candidate.length > current.length ? candidate : current,
  );
  const crossSections = axes
    .filter(({ axis }) => axis !== longest.axis)
    .map(({ length }) => length);

  return {
    length: longest.length,
    radius: Math.max(Math.min(...crossSections) / 2, 0.008),
    rotation:
      longest.axis === "x"
        ? ([0, 0, -Math.PI / 2] as const)
        : longest.axis === "z"
          ? ([Math.PI / 2, 0, 0] as const)
          : ([0, 0, 0] as const),
  };
}

function ComponentMesh({
  component,
  isWarning,
  isHovered,
  onHover,
}: {
  component: CadStructuralComponent;
  isWarning: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const { position, dimensions, rotation, type, tradeCategory } = component;

  const tradeColours = COLORS[tradeCategory];
  const baseColor =
    type in tradeColours
      ? tradeColours[type as keyof typeof tradeColours]
      : "#A0A0A0";

  const isCylinder =
    (tradeCategory === "plumbing" && type === "pipe") ||
    (tradeCategory === "electrical" &&
      (type === "conduit" || type === "cable"));

  const isSphere =
    (tradeCategory === "plumbing" &&
      (type === "fitting" || type === "fixture")) ||
    (tradeCategory === "electrical" && type === "fixture");
  const linearGeometry = getLinearGeometry(component);

  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(component.id);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHover(null);
      }}
    >
      <mesh
        castShadow
        receiveShadow
        rotation={isCylinder ? linearGeometry.rotation : undefined}
      >
        {isSphere ? (
          <sphereGeometry
            args={[
              Math.max(dimensions.x, dimensions.y, dimensions.z) / 2,
              16,
              16,
            ]}
          />
        ) : isCylinder ? (
          <cylinderGeometry
            args={[
              linearGeometry.radius,
              linearGeometry.radius,
              linearGeometry.length,
              16,
            ]}
          />
        ) : (
          <boxGeometry args={[dimensions.x, dimensions.y, dimensions.z]} />
        )}

        <meshStandardMaterial
          color={isWarning ? COLORS.warning : baseColor}
          roughness={tradeCategory === "carpentry" ? 0.8 : 0.4}
          metalness={tradeCategory === "electrical" ? 0.6 : 0.1}
          emissive={isWarning ? COLORS.warning : "#000000"}
          emissiveIntensity={isWarning ? 0.2 : 0}
          transparent={isHovered && !isWarning}
          opacity={isHovered ? 0.8 : 1}
        />

        {isHovered && (
          <Edges color={isWarning ? "#FFFFFF" : COLORS.highlight} />
        )}
      </mesh>

      {isHovered && (
        <Html
          distanceFactor={10}
          position={[0, dimensions.y / 2 + 0.1, 0]}
          center
          zIndexRange={[100, 0]}
        >
          <div className="bg-foreground text-background px-2 py-1 rounded text-xs font-bold whitespace-nowrap shadow-xl pointer-events-none border border-border">
            {component.name}
            {isWarning && (
              <div className="text-destructive-foreground bg-destructive px-1 py-0.5 rounded-[2px] mt-1 text-[10px] uppercase text-center">
                Compliance Issue
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

export function CadCanvas({
  layout,
  complianceResult,
}: {
  layout: CadLayoutPayload;
  complianceResult: CadComplianceResult;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <Canvas
      shadows
      camera={{ position: [5, 5, 5], fov: 50 }}
      className="w-full h-full bg-secondary/5"
    >
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1.5}
        castShadow
        shadow-mapSize={2048}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <directionalLight position={[-10, 5, -10]} intensity={0.5} />

      <Bounds fit clip observe margin={1.2}>
        <group position={[layout.origin.x, layout.origin.y, layout.origin.z]}>
          {layout.structuralComponents.map((component) => (
            <ComponentMesh
              key={component.id}
              component={component}
              isWarning={complianceResult.warningComponentIds.has(component.id)}
              isHovered={hoveredId === component.id}
              onHover={setHoveredId}
            />
          ))}
        </group>
      </Bounds>

      <Grid
        infiniteGrid
        fadeDistance={20}
        fadeStrength={5}
        cellSize={1}
        sectionSize={5}
        sectionColor="#d4d4d8"
        cellColor="#e4e4e7"
      />

      <OrbitControls
        makeDefault
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2 + 0.1}
        enableDamping
        dampingFactor={0.05}
      />
    </Canvas>
  );
}
