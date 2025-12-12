import { Link } from 'react-router-dom';

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Datenschutzerklärung</h1>

        <div className="prose prose-sm text-gray-600 space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">1. Verantwortlicher</h2>
            <p>
              Diese Webanwendung wird privat und nicht-kommerziell betrieben zur internen
              Verwaltung eines Verbandes im Browserspiel „Leitstellenspiel.de". Es handelt
              sich um ein unabhängiges Fan-Projekt ohne Verbindung zum Spielentwickler.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">2. Welche Daten werden erhoben?</h2>
            <p>Folgende Daten werden im Rahmen der Nutzung verarbeitet:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>
                <strong>Accountdaten:</strong> LSS-Spielername, selbst gewähltes Passwort
                (verschlüsselt gespeichert), ggf. ein vom Admin vergebener Anzeigename
              </li>
              <li>
                <strong>Spielbezogene Daten:</strong> Öffentlich im Spiel sichtbare
                Verbandsinformationen (Einsätze, Mitgliederstatus online/offline,
                Verbandsstatistiken)
              </li>
              <li>
                <strong>Technische Daten:</strong> Session-Cookies zur Authentifizierung
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">3. Zweck der Datenverarbeitung</h2>
            <p>Die Daten werden ausschließlich verwendet für:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Authentifizierung und Zugriffskontrolle</li>
              <li>Darstellung der Verbandseinsätze und -statistiken</li>
              <li>Koordination innerhalb des Verbandes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">4. Speicherdauer</h2>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Einsatzdaten:</strong> Werden nach 4 Tagen automatisch gelöscht</li>
              <li><strong>Aktivitätsprotokolle:</strong> Werden nach 30 Tagen automatisch gelöscht</li>
              <li><strong>Accountdaten:</strong> Bis zur Löschung durch einen Administrator</li>
              <li><strong>Verbandsstatistiken:</strong> Aggregierte Daten ohne Personenbezug</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">5. Datenweitergabe</h2>
            <p>
              Es erfolgt keine Weitergabe von Daten an Dritte. Alle Daten verbleiben auf
              dem Server des Betreibers und sind nur für authentifizierte Verbandsmitglieder
              einsehbar.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">6. Cookies</h2>
            <p>
              Diese Anwendung verwendet ausschließlich technisch notwendige Session-Cookies
              zur Authentifizierung. Es werden keine Tracking- oder Analyse-Cookies verwendet.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">7. Deine Rechte</h2>
            <p>Du hast das Recht auf:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Auskunft über deine gespeicherten Daten</li>
              <li>Berichtigung unrichtiger Daten</li>
              <li>Löschung deines Accounts und der zugehörigen Daten</li>
            </ul>
            <p className="mt-2">
              Wende dich bei Fragen oder zur Wahrnehmung deiner Rechte an einen
              Verbandsadministrator.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">8. Sicherheit</h2>
            <p>
              Passwörter werden mit bcrypt verschlüsselt gespeichert. Die Verbindung
              erfolgt ausschließlich über HTTPS. Der Zugriff ist auf authentifizierte
              Verbandsmitglieder beschränkt.
            </p>
          </section>
        </div>

        <div className="mt-8 pt-4 border-t border-gray-200 text-center">
          <Link
            to="/"
            className="text-blue-600 hover:underline text-sm"
          >
            Zurück zur Anmeldung
          </Link>
        </div>
      </div>
    </div>
  );
}
