import { useState } from 'react';
import { useMembers } from '../hooks/useMembers';

export function OnlineMembers() {
  const { onlineMembers, counts, loading } = useMembers();
  const [showDropdown, setShowDropdown] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-gray-400">
        <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
        <span>...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-1.5 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
        title="Online Mitglieder anzeigen"
      >
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span>
          <span className="text-green-600 font-medium">{counts.online}</span>
          <span className="text-gray-400">/{counts.total}</span>
        </span>
        <svg
          className={`w-3 h-3 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border z-20 max-h-80 overflow-auto">
            <div className="p-2 border-b bg-gray-50">
              <span className="text-xs font-medium text-gray-500 uppercase">
                Online Mitglieder
              </span>
            </div>

            {onlineMembers.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center">
                Niemand online
              </div>
            ) : (
              <ul className="py-1">
                {onlineMembers.map((member) => (
                  <li
                    key={member.id}
                    className="px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-sm truncate">{member.name}</span>
                    {member.roleFlags.owner && (
                      <span className="text-xs bg-amber-500 text-white px-1 rounded ml-auto">Owner</span>
                    )}
                    {member.roleFlags.admin && !member.roleFlags.owner && (
                      <span className="text-xs bg-red-500 text-white px-1 rounded ml-auto">Admin</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
