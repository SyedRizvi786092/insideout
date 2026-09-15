export default function Header() {
  return (
    <header className="fixed top-0 inset-x-0 z-40 h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-center px-4">
      <h1 className="text-lg font-bold text-gray-100 flex items-center gap-2 select-none">
        <span role="img" aria-label="cricket bat and ball">
          🏏
        </span>
        <span>InsideOut</span>
      </h1>
    </header>
  );
}

export { Header };
