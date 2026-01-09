import { Link } from "@tanstack/react-router";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

// Top navigation bar with theme toggle and user menu.
export default function Header() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/calendar", label: "Calendar" },
    { to: "/shifts", label: "Shifts" },
  ] as const;

  return (
    <div>
      <div className="flex flex-col gap-2 px-2 py-2 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex gap-3 text-sm sm:text-lg overflow-x-auto whitespace-nowrap">
          {links.map(({ to, label }) => {
            return (
              <Link key={to} to={to}>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  );
}
