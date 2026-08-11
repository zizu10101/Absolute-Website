import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronRight } from 'lucide-react';
import { supabase } from '../supabase';
import { buildProductUrl } from '../utils/slugify';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  image_url: string | null;
  author: string | null;
  published_at: string | null;
  created_at: string;
  featured_product_ids: string[] | null;
}

interface FeaturedProduct {
  id: string;
  name: string;
  price: number;
  salePrice: number | null;
  image: string;
  product_code: string | null;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Splits markdown on its last top-level "## Final Thoughts" heading (case-insensitive) so the
// featured products block can render just above it, matching every article seeded so far.
// Articles without that heading simply render the products block at the end of the content.
function splitBeforeFinalThoughts(content: string): { before: string; after: string } {
  const match = content.match(/\n##\s+final thoughts/i);
  if (!match || match.index === undefined) {
    return { before: content, after: '' };
  }
  return {
    before: content.slice(0, match.index),
    after: content.slice(match.index).replace(/^\n/, ''),
  };
}

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);
    setPost(null);

    (async () => {
      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('*')
          .eq('slug', slug)
          .eq('is_published', true)
          .maybeSingle();

        if (cancelled) return;

        if (!error && data) {
          setPost(data as BlogPost);
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error('Error fetching blog post:', err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  // Featured product cross-sell (hand-picked per-article in Admin), shown above the closing section
  useEffect(() => {
    if (!post?.featured_product_ids || post.featured_product_ids.length === 0) {
      setFeaturedProducts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, price, salePrice, image, product_code')
          .in('id', post.featured_product_ids || []);

        if (!cancelled && !error && data) {
          // Preserve the order the admin selected them in, not whatever order the DB returns
          const byId = new Map(data.map((p: FeaturedProduct) => [p.id, p]));
          const ordered = (post.featured_product_ids || []).map(id => byId.get(id)).filter(Boolean) as FeaturedProduct[];
          setFeaturedProducts(ordered);
        }
      } catch (err) {
        console.error('Error fetching featured products for blog post:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [post?.id]);

  // BlogPosting JSON-LD schema
  useEffect(() => {
    if (!post) return;

    const existing = document.getElementById('blog-schema-markup');
    if (existing) existing.remove();

    const schema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": post.title,
      "author": {
        "@type": "Organization",
        "name": "Absolute Soccer Mississauga"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Absolute Soccer Mississauga",
        "url": "https://torontosoccershop.com"
      },
      "datePublished": post.published_at || post.created_at,
      "url": `https://torontosoccershop.com/blog/${post.slug}`
    };

    const script = document.createElement('script');
    script.id = 'blog-schema-markup';
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.getElementById('blog-schema-markup')?.remove();
    };
  }, [post]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">Loading Article...</p>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <h1 className="text-2xl font-black uppercase italic tracking-tighter">Article Not Found</h1>
        <Link to="/blog" className="text-[var(--primary-color)] font-bold uppercase tracking-widest text-sm hover:underline">Back to Gear Guides</Link>
      </div>
    );
  }

  const { before: contentBeforeFinal, after: contentFinal } = splitBeforeFinalThoughts(post.content);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-12">
      <Helmet>
        <title>{post.title} | Absolute Soccer Mississauga</title>
        <meta name="description" content={post.excerpt || post.title} />
        <link rel="canonical" href={`https://torontosoccershop.com/blog/${post.slug}`} />
      </Helmet>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-8">
        <Link to="/" className="hover:text-[var(--primary-color)] transition-colors">Home</Link>
        <ChevronRight size={12} className="text-zinc-300" />
        <Link to="/blog" className="hover:text-[var(--primary-color)] transition-colors">Gear Guides</Link>
        <ChevronRight size={12} className="text-zinc-300" />
        <span className="text-zinc-900 truncate max-w-[200px] sm:max-w-none">{post.title}</span>
      </nav>

      <h1 className="text-3xl md:text-5xl font-headline font-black uppercase italic tracking-tighter leading-tight mb-4">
        {post.title}
      </h1>

      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500 mb-10 pb-10 border-b border-zinc-100">
        <span>{post.author || 'Absolute Soccer Gear Experts'}</span>
        <span className="w-1 h-1 rounded-full bg-zinc-300" />
        <span>{formatDate(post.published_at || post.created_at)}</span>
      </div>

      {post.image_url && (
        <div className="w-full rounded-xl overflow-hidden mb-8">
          <img
            src={post.image_url}
            alt={post.title}
            className="w-full h-auto object-contain"
            style={{ maxHeight: '500px' }}
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      <div className="blog-prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{contentBeforeFinal}</ReactMarkdown>
      </div>

      {featuredProducts.length > 0 && (
        <div className="my-8 p-6 bg-zinc-50 rounded-xl">
          <h3 className="text-lg font-bold mb-4">
            Featured Footwear at Absolute Soccer
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {featuredProducts.map(product => (
              <Link to={buildProductUrl(product)} key={product.id}>
                <div className="bg-white rounded-lg p-3 border hover:shadow-md transition">
                  <img src={product.image} alt={product.name} className="w-full aspect-square object-contain mb-2" referrerPolicy="no-referrer" />
                  <p className="text-xs font-semibold line-clamp-2">{product.name}</p>
                  <p className="text-sm font-bold text-[#b90014] mt-1">
                    ${product.salePrice || product.price}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <Link to="/category/footwear"
            className="block text-center mt-4 text-sm text-[#b90014] font-medium hover:underline">
            View All Footwear &rarr;
          </Link>
        </div>
      )}

      {contentFinal && (
        <div className="blog-prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{contentFinal}</ReactMarkdown>
        </div>
      )}

      <div className="mt-16 pt-8 border-t border-zinc-100">
        <Link to="/blog" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-900 hover:text-[var(--primary-color)] transition-colors">
          &larr; Back to Gear Guides
        </Link>
      </div>
    </div>
  );
}
