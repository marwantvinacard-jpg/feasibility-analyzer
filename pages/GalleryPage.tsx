import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Download, ImageOff, Sparkles } from "lucide-react";
import { listGenerations, type GenerationItem } from "../services/api";
import { AIDisclaimer } from "../components/AIDisclaimer";

export const GalleryPage: React.FC = () => {
  const [items, setItems] = useState<GenerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listGenerations()
      .then(setItems)
      .catch((e) => setError(e?.message || "Failed to load gallery."))
      .finally(() => setLoading(false));
  }, []);

  const download = (item: GenerationItem) => {
    const a = document.createElement("a");
    a.href = item.imageUrl;
    a.download = `${item.styleTitle || "design"}-${item.id}.png`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-4xl text-charcoal mb-1">Your Gallery</h1>
          <p className="text-gray-500">
            Every design you generate is saved here automatically.
          </p>
        </div>
        <Link
          to="/app"
          className="inline-flex items-center gap-2 bg-charcoal text-white font-bold px-5 py-2.5 rounded-full hover:bg-black"
        >
          <Sparkles size={16} /> New design
        </Link>
      </div>

      <AIDisclaimer className="mb-8" />

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="animate-spin text-gold-500" size={32} />
        </div>
      ) : error ? (
        <div className="text-center py-24 text-red-600">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <ImageOff size={40} className="mx-auto mb-4" />
          <p className="mb-4">You haven't generated any designs yet.</p>
          <Link
            to="/app"
            className="inline-flex items-center gap-2 text-gold-600 font-bold"
          >
            <Sparkles size={16} /> Create your first design
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="group bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow fade-in"
            >
              <div className="relative aspect-video bg-gray-100">
                <img
                  src={item.imageUrl}
                  alt={item.styleTitle}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => download(item)}
                  className="absolute top-3 right-3 bg-white/90 backdrop-blur rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                  title="Download"
                >
                  <Download size={16} className="text-charcoal" />
                </button>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-charcoal truncate">
                    {item.styleTitle || "Design"}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-gold-600 whitespace-nowrap">
                    {item.mode?.replace("_", " ")}
                  </span>
                </div>
                {item.prompt && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {item.prompt}
                  </p>
                )}
                {item.createdAt && (
                  <p className="text-[11px] text-gray-400 mt-2">
                    {new Date(item.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};
