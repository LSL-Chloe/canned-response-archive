/** One composited, slowly drifting background shared by the workspace and authentication. */
export default function OpticalBackdrop() {
  return (
    <div className="optical-environment" aria-hidden="true">
      <div className="optical-weave" />
      <div className="optical-caustic optical-caustic-a" />
      <div className="optical-caustic optical-caustic-b" />
    </div>
  );
}
