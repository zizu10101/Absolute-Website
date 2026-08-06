import { Helmet } from 'react-helmet-async';

export function UniformSubmissionPage() {
  return (
    <>
      <Helmet>
        <title>Kit Orders - Custom Uniform Designer | Absolute Soccer Mississauga</title>
        <meta
          name="description"
          content="Design your team's custom uniform online. Absolute Soccer Mississauga custom kit designer."
        />
        <link rel="canonical" href="https://torontosoccershop.com/kit-orders" />
      </Helmet>

      <div className="w-full">
        <iframe
          src="https://absolute-uniform.ai.studio"
          className="w-full block border-none h-[calc(100vh-73px)] md:h-[calc(100vh-113px)]"
          title="Custom Uniform Designer"
          allow="fullscreen"
        />
      </div>
    </>
  );
}
