import React from "react";

interface EventItem {
  sl: number;
  group: string;
  event: string;
}

const events: EventItem[] = [
  { sl: 1, group: "U-10 Girls", event: "50 Mts Free Style" },
  { sl: 2, group: "Open to All (Male)", event: "1000 Mts Free Style" },
  { sl: 3, group: "U-12 Girls", event: "50 Mts Free Style" },
  { sl: 4, group: "U-14 Girls", event: "50 Mts Free Style" },
  { sl: 5, group: "U-17 Girls", event: "50 Mts Free Style" },
  { sl: 6, group: "Women", event: "50 Mts Free Style" },

  { sl: 7, group: "U-10 Boys", event: "50 Mts Free Style" },
  { sl: 8, group: "U-12 Boys", event: "50 Mts Free Style" },
  { sl: 9, group: "U-14 Boys", event: "50 Mts Free Style" },
  { sl: 10, group: "U-17 Boys", event: "100 Mts Free Style" },
  { sl: 11, group: "Men", event: "100 Mts Free Style" },

  { sl: 12, group: "U-10 Girls", event: "50 Mts Back Stroke" },
  { sl: 13, group: "U-12 Girls", event: "50 Mts Back Stroke" },
  { sl: 14, group: "U-14 Girls", event: "50 Mts Back Stroke" },
  { sl: 15, group: "U-17 Girls", event: "50 Mts Back Stroke" },
  { sl: 16, group: "Women", event: "50 Mts Back Stroke" },

  { sl: 17, group: "U-10 Boys", event: "50 Mts Back Stroke" },
  { sl: 18, group: "U-12 Boys", event: "50 Mts Back Stroke" },
  { sl: 19, group: "U-14 Boys", event: "50 Mts Back Stroke" },
  { sl: 20, group: "U-17 Boys", event: "50 Mts Back Stroke" },
  { sl: 21, group: "Men", event: "50 Mts Back Stroke" },

  { sl: 22, group: "U-12 Girls", event: "50 Mts Breast Stroke" },
  { sl: 23, group: "U-14 Girls", event: "50 Mts Breast Stroke" },
  { sl: 24, group: "U-17 Girls", event: "50 Mts Breast Stroke" },
  { sl: 25, group: "Women", event: "50 Mts Breast Stroke" },

  { sl: 26, group: "U-12 Boys", event: "50 Mts Breast Stroke" },
  { sl: 27, group: "U-14 Boys", event: "50 Mts Breast Stroke" },
  { sl: 28, group: "U-17 Boys", event: "50 Mts Butter Fly" },
  { sl: 29, group: "Men", event: "50 Mts Butter Fly" },
];

const EventList: React.FC = () => {
  return (
    <section className="w-full py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-sm sm:text-base font-semibold text-cyan-600 uppercase tracking-widest">
            43rd Swimming Competition - 2026
          </p>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 mt-2">
            Order of Event
          </h2>

          <div className="w-24 h-1 bg-gradient-to-r from-cyan-500 to-blue-600 mx-auto mt-4 rounded-full" />

          <p className="text-slate-500 mt-4">
            Organised by Town Club Cooch Behar
          </p>
        </div>

        {/* Event Table */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">

          {/* Desktop Header */}
          <div className="hidden sm:grid grid-cols-[90px_1fr_1.5fr] bg-gradient-to-r from-slate-900 to-blue-900 text-white font-bold">
            <div className="px-5 py-4 text-center">
              SL NO
            </div>

            <div className="px-5 py-4">
              GROUP
            </div>

            <div className="px-5 py-4">
              EVENT
            </div>
          </div>

          {/* Events */}
          <div>
            {events.map((item, index) => (
              <div
                key={item.sl}
                className={`
                  grid grid-cols-1 sm:grid-cols-[90px_1fr_1.5fr]
                  border-b border-slate-200
                  last:border-b-0
                  transition-colors
                  hover:bg-cyan-50
                  ${index % 2 === 0 ? "bg-white" : "bg-slate-50/70"}
                `}
              >

                {/* Serial */}
                <div className="px-5 py-3 flex items-center sm:justify-center">
                  <span className="sm:hidden font-semibold text-slate-500 mr-2">
                    SL NO:
                  </span>

                  <span className="font-bold text-slate-700">
                    {item.sl}
                  </span>
                </div>

                {/* Group */}
                <div className="px-5 py-3 flex items-center">
                  <span className="sm:hidden font-semibold text-slate-500 mr-2">
                    Group:
                  </span>

                  <span className="font-semibold text-slate-800">
                    {item.group}
                  </span>
                </div>

                {/* Event */}
                <div className="px-5 py-3 flex items-center">
                  <span className="sm:hidden font-semibold text-slate-500 mr-2">
                    Event:
                  </span>

                  <span className="text-slate-600">
                    {item.event}
                  </span>
                </div>

              </div>
            ))}
          </div>
        </div>

        {/* Footer information */}
        <div className="mt-6 text-center text-sm text-slate-500">
          <p>
            📍 Swimming Pool, Cooch Behar Stadium, Raibari Complex
          </p>

          <p className="mt-1">
            📅 15th August 2026
          </p>
        </div>

      </div>
    </section>
  );
};

export default EventList;
