import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../supabase';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  author: string | null;
  published_at: string | null;
  created_at: string;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function PostImage({ post, className }: { post: BlogPost; className: string }) {
  const src = post.thumbnail_url || post.image_url;
  if (src) {
    return <img src={src} alt={post.title} className={className} referrerPolicy="no-referrer" />;
  }
  return (
    <div className={`${className} bg-gradient-to-br from-zinc-900 to-zinc-700 flex items-center justify-center`}>
      <span className="text-white/20 font-black uppercase italic text-2xl tracking-tighter">Absolute Soccer</span>
    </div>
  );
}

export function BlogListPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('id, title, slug, excerpt, image_url, thumbnail_url, author, published_at, created_at')
          .eq('is_published', true)
          .order('published_at', { ascending: false });

        if (!cancelled && !error && data) {
          setPosts(data as BlogPost[]);
        }
      } catch (err) {
        console.error('Error fetching blog posts:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-12">
      <Helmet>
        <title>Gear Guides | Absolute Soccer Mississauga</title>
        <meta name="description" content="Expert soccer gear guides, cleat comparisons, and tips from Absolute Soccer Mississauga — buy smarter, play better." />
        <link rel="canonical" href="https://torontosoccershop.com/blog" />
      </Helmet>

      <div className="mb-12">
        <h1 className="text-5xl md:text-7xl font-headline font-black uppercase italic tracking-tighter leading-none mb-4">
          Gear Guides
        </h1>
        <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs">
          Expert tips and gear comparisons from Absolute Soccer Mississauga
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-zinc-600 font-bold uppercase tracking-widest text-xs">Loading articles...</div>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-zinc-50 rounded-xl">
          <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs mb-2">No articles yet</p>
          <p className="text-zinc-500 text-sm">Check back soon for gear guides and tips.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post, idx) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.05, 0.3) }}
            >
              <Link to={`/blog/${post.slug}`} className="group flex flex-col h-full bg-white border border-zinc-100 rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-[4/3] overflow-hidden">
                  <PostImage post={post} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">
                    {formatDate(post.published_at || post.created_at)}
                  </p>
                  <h3 className="text-base font-headline font-black uppercase italic tracking-tight leading-snug mb-3 group-hover:text-[var(--primary-color)] transition-colors flex-1">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-zinc-600 text-sm leading-relaxed mb-4 line-clamp-3">{post.excerpt}</p>
                  )}
                  <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-900 group-hover:text-[var(--primary-color)] group-hover:translate-x-1 transition-all mt-auto">
                    Read More <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
