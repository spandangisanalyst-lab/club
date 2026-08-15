// ============================================================
// NEW SECTION: CERTIFICATE GENERATOR
// File: src/components/admin/AdminCertificates.tsx
//
// IMPORTANT:
// Put certificate.png inside:
// public/certificate.png
//
// This section uses the existing completed-event/results data
// and creates a certificate for the selected swimmer.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { Award, Download, Printer, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CertificateResult {
  participant_id: string;
  participant_name: string;
  event_name: string;
  category: string;
  position: number;
  time?: string;
}

export default function AdminCertificates() {
  const [results, setResults] = useState<CertificateResult[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedResult, setSelectedResult] =
    useState<CertificateResult | null>(null);

  const loadCertificateResults = async () => {
    try {
      setLoading(true);

      // -------------------------------------------------------
      // Get completed heats
      // -------------------------------------------------------
      const { data: heats, error: heatsError } =
        await supabase
          .from('heats')
          .select(
            `
              id,
              event_id,
              status,
              events(*)
            `
          )
          .eq('status', 'finished');

      if (heatsError) throw heatsError;

      if (!heats || heats.length === 0) {
        setResults([]);
        return;
      }

      const heatIds = heats.map(
        (heat: any) => heat.id
      );

      // -------------------------------------------------------
      // Get heat entries
      // -------------------------------------------------------
      const { data: entries, error: entriesError } =
        await supabase
          .from('heat_entries')
          .select('*')
          .in('heat_id', heatIds);

      if (entriesError) throw entriesError;

      if (!entries || entries.length === 0) {
        setResults([]);
        return;
      }

      // -------------------------------------------------------
      // Get participants
      // -------------------------------------------------------
      const participantIds = [
        ...new Set(
          entries
            .map(
              (entry: any) =>
                entry.participant_id
            )
            .filter(Boolean)
        ),
      ];

      const { data: participants, error: participantsError } =
        await supabase
          .from('participants')
          .select('*')
          .in(
            'id',
            participantIds
          );

      if (participantsError) {
        throw participantsError;
      }

      const participantMap = new Map(
        (participants || []).map(
          (participant: any) => [
            String(participant.id),
            participant,
          ]
        )
      );

      // -------------------------------------------------------
      // Build result list
      //
      // Keep the fastest time for a swimmer.
      // -------------------------------------------------------
      const resultMap =
        new Map<string, CertificateResult>();

      entries.forEach((entry: any) => {
        const participant =
          participantMap.get(
            String(entry.participant_id)
          );

        if (!participant) return;

        const event = heats.find(
          (heat: any) =>
            String(heat.id) ===
            String(entry.heat_id)
        )?.events;

        const eventData = Array.isArray(event)
          ? event[0]
          : event;

        const eventName =
          eventData?.event_name ||
          eventData?.title ||
          eventData?.name ||
          'Swimming Event';

        const category =
          eventData?.category ||
          participant?.category ||
          participant?.age_group ||
          '';

        const time = entry.time || '';

        // Convert 00:00.00 to milliseconds
        const match = String(time).match(
          /^(\d+):(\d{2})\.(\d{1,3})$/
        );

        if (!match) return;

        const minutes = Number(match[1]);
        const seconds = Number(match[2]);
        const fraction =
          match[3].padEnd(3, '0');

        const timeMs =
          minutes * 60000 +
          seconds * 1000 +
          Number(fraction);

        const key = String(
          participant.id
        );

        const existing =
          resultMap.get(key);

        if (
          !existing ||
          timeMs <
            Number(
              (existing as any)._timeMs ||
                Infinity
            )
        ) {
          resultMap.set(key, {
            participant_id:
              participant.id,

            participant_name:
              participant.name ||
              participant.full_name ||
              'Unknown',

            event_name: eventName,

            category,

            position:
              entry.overall_rank ||
              0,

            time,
          } as CertificateResult & {
            _timeMs: number;
          });

          (
            resultMap.get(key) as any
          )._timeMs = timeMs;
        }
      });

      // -------------------------------------------------------
      // Convert to array
      // -------------------------------------------------------
      const resultArray =
        Array.from(
          resultMap.values()
        );

      // -------------------------------------------------------
      // IMPORTANT:
      // Position is calculated separately for each event.
      // -------------------------------------------------------
      const grouped =
        new Map<string, CertificateResult[]>();

      resultArray.forEach(
        (result) => {
          const key =
            `${result.event_name}__${result.category}`;

          if (!grouped.has(key)) {
            grouped.set(key, []);
          }

          grouped
            .get(key)!
            .push(result);
        }
      );

      const finalResults: CertificateResult[] = [];

      grouped.forEach(
        (eventResults) => {
          eventResults.sort(
            (a: any, b: any) =>
              Number(
                a._timeMs || Infinity
              ) -
              Number(
                b._timeMs || Infinity
              )
          );

          eventResults.forEach(
            (result, index) => {
              finalResults.push({
                ...result,
                position:
                  index + 1,
              });
            }
          );
        }
      );

      setResults(finalResults);
    } catch (error) {
      console.error(
        'Error loading certificate results:',
        error
      );

      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificateResults();
  }, []);

  // -----------------------------------------------------------
  // SEARCH
  // -----------------------------------------------------------
  const filteredResults = useMemo(() => {
    const q =
      search.trim().toLowerCase();

    if (!q) return results;

    return results.filter(
      (result) =>
        result.participant_name
          .toLowerCase()
          .includes(q) ||
        result.event_name
          .toLowerCase()
          .includes(q) ||
        result.category
          .toLowerCase()
          .includes(q)
    );
  }, [results, search]);

  // -----------------------------------------------------------
  // PRINT CERTIFICATE
  // -----------------------------------------------------------
  const printCertificate = () => {
    if (!selectedResult) return;

    window.print();
  };

  // -----------------------------------------------------------
  // DOWNLOAD / PRINT
  // Browser print dialog can save as PDF.
  // -----------------------------------------------------------
  const downloadCertificate = () => {
    if (!selectedResult) return;

    window.print();
  };

  return (
    <div className="space-y-6">

      {/* =====================================================
          HEADER
      ====================================================== */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-cyan-600 text-white flex items-center justify-center">
          <Award className="w-6 h-6" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Certificate Generator
          </h2>

          <p className="text-sm text-slate-500">
            Generate achievement certificates for winning swimmers.
          </p>
        </div>
      </div>

      {/* =====================================================
          MAIN SCREEN
      ====================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ===================================================
            RESULT SELECTION
        ==================================================== */}
        <div className="xl:col-span-1 bg-white border border-slate-200 rounded-2xl shadow-sm p-5">

          <h3 className="font-bold text-lg text-slate-900 mb-4">
            Select Winner
          </h3>

          <div className="relative mb-4">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search swimmer or event..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-cyan-500"
            />
          </div>

          {loading ? (
            <div className="py-10 text-center text-slate-500">
              Loading results...
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              No results found.
            </div>
          ) : (
            <div className="space-y-2 max-h-[650px] overflow-y-auto">

              {filteredResults.map(
                (result, index) => {

                  const selected =
                    selectedResult?.participant_id ===
                      result.participant_id &&
                    selectedResult?.event_name ===
                      result.event_name &&
                    selectedResult?.category ===
                      result.category;

                  return (
                    <button
                      key={`${result.participant_id}-${result.event_name}-${index}`}
                      onClick={() =>
                        setSelectedResult(
                          result
                        )
                      }
                      className={`w-full text-left p-3 rounded-xl border transition ${
                        selected
                          ? 'border-cyan-500 bg-cyan-50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">

                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold ${
                            result.position ===
                            1
                              ? 'bg-yellow-100 text-yellow-700'
                              : result.position ===
                                2
                              ? 'bg-slate-200 text-slate-700'
                              : result.position ===
                                3
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {result.position}
                        </div>

                        <div className="min-w-0 flex-1">

                          <div className="font-bold text-slate-900 truncate">
                            {
                              result.participant_name
                            }
                          </div>

                          <div className="text-xs text-slate-500 truncate">
                            {
                              result.event_name
                            }
                          </div>

                          <div className="text-xs text-slate-400">
                            {
                              result.category
                            }
                          </div>

                        </div>

                      </div>
                    </button>
                  );
                }
              )}

            </div>
          )}

        </div>

        {/* ===================================================
            CERTIFICATE PREVIEW
        ==================================================== */}
        <div className="xl:col-span-2 bg-slate-100 rounded-2xl border border-slate-200 p-5">

          <div className="flex items-center justify-between mb-4">

            <div>
              <h3 className="font-bold text-lg text-slate-900">
                Certificate Preview
              </h3>

              <p className="text-xs text-slate-500">
                Select a swimmer to generate the certificate.
              </p>
            </div>

            {selectedResult && (
              <div className="flex gap-2">

                <button
                  onClick={
                    printCertificate
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-900"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>

                <button
                  onClick={
                    downloadCertificate
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700"
                >
                  <Download className="w-4 h-4" />
                  Save PDF
                </button>

              </div>
            )}

          </div>

          {!selectedResult ? (

            <div className="aspect-[1472/1024] bg-white rounded-xl flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Award className="w-16 h-16 mx-auto mb-3 text-slate-300" />

                <p className="font-semibold">
                  Select a winner
                </p>

                <p className="text-sm">
                  The certificate will appear here.
                </p>
              </div>
            </div>

          ) : (

            /*
             * ==================================================
             * CERTIFICATE
             *
             * Background:
             * public/certificate.png
             *
             * The positions below are percentage based so the
             * certificate scales correctly.
             * ==================================================
             */
            <div
              id="certificate-print-area"
              className="certificate-page relative w-full overflow-hidden bg-white"
              style={{
                aspectRatio:
                  '1472 / 1024',
                backgroundImage:
                  "url('/certificate.png')",
                backgroundSize:
                  '100% 100%',
                backgroundPosition:
                  'center',
                backgroundRepeat:
                  'no-repeat',
              }}
            >

              {/* =============================================
                  NAME
              ============================================== */}
              <div
                className="absolute text-center font-bold text-slate-900"
                style={{
                  left: '18%',
                  width: '64%',
                  top: '43.5%',
                  fontSize:
                    'clamp(18px, 3vw, 42px)',
                  fontFamily:
                    'Georgia, serif',
                }}
              >
                {
                  selectedResult.participant_name
                }
              </div>

              {/* =============================================
                  EVENT
              ============================================== */}
              <div
                className="absolute text-center font-bold text-slate-900"
                style={{
                  left: '15%',
                  width: '27%',
                  top: '59.5%',
                  fontSize:
                    'clamp(12px, 1.5vw, 23px)',
                  fontFamily:
                    'Georgia, serif',
                }}
              >
                {
                  selectedResult.event_name
                }
              </div>

              {/* =============================================
                  AGE GROUP
              ============================================== */}
              <div
                className="absolute text-center font-bold text-slate-900"
                style={{
                  left: '38.5%',
                  width: '23%',
                  top: '59.5%',
                  fontSize:
                    'clamp(12px, 1.5vw, 23px)',
                  fontFamily:
                    'Georgia, serif',
                }}
              >
                {
                  selectedResult.category ||
                  '—'
                }
              </div>

              {/* =============================================
                  POSITION
              ============================================== */}
              <div
                className="absolute text-center font-bold text-slate-900"
                style={{
                  left: '64%',
                  width: '21%',
                  top: '59.5%',
                  fontSize:
                    'clamp(14px, 1.8vw, 27px)',
                  fontFamily:
                    'Georgia, serif',
                }}
              >
                {selectedResult.position ===
                1
                  ? '1st'
                  : selectedResult.position ===
                    2
                  ? '2nd'
                  : selectedResult.position ===
                    3
                  ? '3rd'
                  : `${selectedResult.position}th`}
              </div>

            </div>

          )}

        </div>
      </div>

      {/* =====================================================
          PRINT CSS
      ====================================================== */}
      <style>{`
        @media print {

          body * {
            visibility: hidden !important;
          }

          #certificate-print-area,
          #certificate-print-area * {
            visibility: visible !important;
          }

          #certificate-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;

            width: 100vw !important;
            height: auto !important;

            aspect-ratio: 1472 / 1024 !important;

            margin: 0 !important;
            padding: 0 !important;

            background-size: 100% 100% !important;

            box-shadow: none !important;
            border: none !important;
          }

          @page {
            size: landscape;
            margin: 0;
          }
        }
      `}</style>

    </div>
  );
}
