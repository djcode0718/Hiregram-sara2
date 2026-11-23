import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  extractJobContextFromDocument
} from '../../extension/src/content/extractor.js';

test('JSON-LD JobPosting with standard schema extraction', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "Senior Backend Engineer",
          "description": "<p>We are seeking an experienced Senior Backend Engineer with a strong background in distributed systems, microservices, and reliable cloud infrastructure. In this role, you will lead the architecture of high-throughput payment systems, collaborate with product managers and security specialists, and mentor junior developers. We value clean code, thorough automated testing, and thoughtful engineering design.</p><ul><li>Design and maintain scalable APIs</li><li>Ensure high uptime and security</li><li>Collaborate with cross-functional teams</li></ul>",
          "hiringOrganization": {
            "@type": "Organization",
            "name": "Stripe"
          },
          "jobLocation": {
            "@type": "Place",
            "address": {
              "addressLocality": "San Francisco",
              "addressRegion": "CA",
              "addressCountry": "US"
            }
          },
          "employmentType": "FULL_TIME",
          "url": "https://stripe.com/jobs/12345"
        }
        </script>
      </head>
      <body></body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://stripe.com/jobs/12345?utm_source=test' });
  const ctx = extractJobContextFromDocument(dom.window.document, dom.window);

  assert.equal(ctx.source, 'jsonld');
  assert.equal(ctx.title, 'Senior Backend Engineer');
  assert.equal(ctx.company, 'Stripe');
  assert.equal(ctx.location, 'San Francisco, CA, US');
  assert.equal(ctx.employmentType, 'FULL_TIME');
  assert.match(ctx.description, /Senior Backend Engineer/);
  assert.match(ctx.description, /- Design and maintain scalable APIs/);
  assert.equal(ctx.confidence, 'high');
  assert.equal(ctx.url, 'https://stripe.com/jobs/12345');
});

test('JSON-LD with @graph array and invalid JSON blocks', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script type="application/ld+json">{ invalid json syntax </script>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebSite", "name": "Careers" },
            {
              "@type": "JobPosting",
              "title": "Frontend Architect",
              "description": "<p>Lead our UI architecture and Chrome extension engineering team across global products.</p>",
              "hiringOrganization": { "name": "Vercel" },
              "jobLocationType": "TELECOMMUTE"
            }
          ]
        }
        </script>
      </head>
      <body></body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://vercel.com/careers/frontend' });
  const ctx = extractJobContextFromDocument(dom.window.document, dom.window);

  assert.equal(ctx.title, 'Frontend Architect');
  assert.equal(ctx.company, 'Vercel');
  assert.equal(ctx.location, 'Remote');
  assert.match(ctx.description, /Lead our UI architecture/);
});

test('LinkedIn adapter extraction', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="jobs-details__main-content">
          <h1 class="job-details-jobs-unified-top-card__job-title">Staff AI Engineer</h1>
          <div class="job-details-jobs-unified-top-card__company-name">Google DeepMind</div>
          <span class="job-details-jobs-unified-top-card__bullet">London, UK</span>
          <div id="job-details">
            <p>Join Google DeepMind to build autonomous agentic platforms and next-generation reasoning systems. You will work alongside world-class researchers and engineers to design, build, and deploy high-reliability foundation model infrastructure at global scale.</p>
            <h3>Responsibilities</h3>
            <ul>
              <li>Architect foundation models and multi-agent execution graphs</li>
              <li>Deploy high-scale distributed inference pipelines</li>
              <li>Ensure model safety and alignment across all customer-facing systems</li>
            </ul>
          </div>
        </div>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://www.linkedin.com/jobs/view/999888777/' });
  const ctx = extractJobContextFromDocument(dom.window.document, dom.window);

  assert.equal(ctx.source, 'adapter:linkedin');
  assert.equal(ctx.title, 'Staff AI Engineer');
  assert.equal(ctx.company, 'Google DeepMind');
  assert.equal(ctx.location, 'London, UK');
  assert.match(ctx.description, /Join Google DeepMind to build autonomous agentic platforms/);
  assert.match(ctx.description, /- Architect foundation models/);
  assert.equal(ctx.confidence, 'high');
});

test('Greenhouse adapter extraction', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <div id="header">
          <h1 class="app-title">Lead Product Designer</h1>
          <span class="company-name">Figma</span>
        </div>
        <div class="location">San Francisco, CA</div>
        <div id="content">
          <p>We are seeking a Lead Product Designer to shape the future of collaborative design systems and vector drawing tools. You will lead cross-functional design sprints, craft beautiful user experiences, and establish foundational design tokens used by millions of creative professionals worldwide.</p>
          <h2>Requirements</h2>
          <ul>
            <li>8+ years of product design experience in digital tooling</li>
            <li>Figma mastery and proven design systems leadership</li>
            <li>Passionate about craft, typography, and developer hand-off</li>
          </ul>
        </div>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://boards.greenhouse.io/figma/jobs/555123' });
  const ctx = extractJobContextFromDocument(dom.window.document, dom.window);

  assert.equal(ctx.source, 'adapter:greenhouse');
  assert.equal(ctx.title, 'Lead Product Designer');
  assert.equal(ctx.company, 'Figma');
  assert.equal(ctx.location, 'San Francisco, CA');
  assert.match(ctx.description, /Lead Product Designer to shape the future/);
  assert.equal(ctx.confidence, 'high');
});

test('Lever adapter extraction', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="main-header-logo"><img alt="Retool" src="/logo.png" /></div>
        <div class="posting-headline">
          <h2>Full Stack Engineer</h2>
        </div>
        <div class="posting-category location">New York, NY</div>
        <div class="section page-centered" data-qa="job-description">
          <p>At Retool, we believe internal software should be as fast to build as it is enjoyable to use.</p>
          <p>You will build real-time components and collaborative canvases.</p>
        </div>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://jobs.lever.co/retool/abc-123' });
  const ctx = extractJobContextFromDocument(dom.window.document, dom.window);

  assert.equal(ctx.source, 'adapter:lever');
  assert.equal(ctx.title, 'Full Stack Engineer');
  assert.equal(ctx.company, 'Retool');
  assert.equal(ctx.location, 'New York, NY');
  assert.match(ctx.description, /At Retool, we believe internal software/);
});

test('Wellfound adapter extraction', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <h1 data-test="JobTitle">Founding Growth Engineer</h1>
        <div data-test="StartupName">NextAI</div>
        <div data-test="JobLocation">Remote</div>
        <div data-test="JobDescription">
          <p>Join as founding engineer to scale our user acquisition engines.</p>
          <p>Requirements include full-stack web and analytics experience.</p>
        </div>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://wellfound.com/jobs/12345' });
  const ctx = extractJobContextFromDocument(dom.window.document, dom.window);

  assert.equal(ctx.source, 'adapter:wellfound');
  assert.equal(ctx.title, 'Founding Growth Engineer');
  assert.equal(ctx.company, 'NextAI');
  assert.equal(ctx.location, 'Remote');
  assert.match(ctx.description, /Join as founding engineer/);
});

test('Indeed adapter extraction', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <h1 class="jobsearch-JobInfoHeader-title">DevOps Specialist</h1>
        <div data-testid="inlineHeader-companyName">Datadog</div>
        <div data-testid="inlineHeader-companyLocation">Boston, MA</div>
        <div id="jobDescriptionText">
          <p>Manage cloud infrastructure and observability pipelines across multiple Kubernetes clusters.</p>
        </div>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://www.indeed.com/viewjob?jk=123abc' });
  const ctx = extractJobContextFromDocument(dom.window.document, dom.window);

  assert.equal(ctx.source, 'adapter:indeed');
  assert.equal(ctx.title, 'DevOps Specialist');
  assert.equal(ctx.company, 'Datadog');
  assert.equal(ctx.location, 'Boston, MA');
  assert.match(ctx.description, /Manage cloud infrastructure and observability/);
});

test('Naukri adapter extraction', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <h1 class="styles_jd-header-title__">Senior Java Developer</h1>
        <div class="styles_jd-header-comp-name__"><a href="#">Infosys</a></div>
        <div class="styles_jhc__location__">Bangalore/Bengaluru</div>
        <div class="styles_JDJobs-rec-desc__">
          <p>Hands on experience in Spring Boot, Microservices, and cloud deployments.</p>
        </div>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://www.naukri.com/job-listings-123' });
  const ctx = extractJobContextFromDocument(dom.window.document, dom.window);

  assert.equal(ctx.source, 'adapter:naukri');
  assert.equal(ctx.title, 'Senior Java Developer');
  assert.equal(ctx.company, 'Infosys');
  assert.equal(ctx.location, 'Bangalore/Bengaluru');
  assert.match(ctx.description, /Hands on experience in Spring Boot/);
});

test('Ashby adapter extraction', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Platform Engineer</h1>
        <header><a class="companyName">Ramp</a></header>
        <div class="location">New York</div>
        <div class="description">
          <p>Build infrastructure that powers financial automation for thousands of businesses.</p>
        </div>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://jobs.ashbyhq.com/ramp/job-1' });
  const ctx = extractJobContextFromDocument(dom.window.document, dom.window);

  assert.equal(ctx.source, 'adapter:ashby');
  assert.equal(ctx.title, 'Platform Engineer');
  assert.equal(ctx.company, 'Ramp');
  assert.match(ctx.description, /Build infrastructure that powers financial automation/);
});

test('Workday adapter extraction', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <h2 data-automation-id="jobTitle">Security Engineer</h2>
        <div data-automation-id="companyName">Salesforce</div>
        <div data-automation-id="locations">San Francisco, CA</div>
        <div data-automation-id="jobPostingDescription">
          <p>Perform application security audits, penetration testing, and security architecture reviews.</p>
        </div>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://salesforce.myworkdayjobs.com/en-US/Careers/job/1' });
  const ctx = extractJobContextFromDocument(dom.window.document, dom.window);

  assert.equal(ctx.source, 'adapter:workday');
  assert.equal(ctx.title, 'Security Engineer');
  assert.equal(ctx.company, 'Salesforce');
  assert.equal(ctx.location, 'San Francisco, CA');
  assert.match(ctx.description, /Perform application security audits/);
});

test('Instahyre adapter extraction', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <h1 class="job-title">Senior ML Engineer</h1>
        <div class="company-name">Swiggy</div>
        <div class="job-location">Bangalore</div>
        <div id="job-description">
          <p>Optimize recommendation algorithms and dispatch logistics in real time.</p>
        </div>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://www.instahyre.com/job-1234' });
  const ctx = extractJobContextFromDocument(dom.window.document, dom.window);

  assert.equal(ctx.source, 'adapter:instahyre');
  assert.equal(ctx.title, 'Senior ML Engineer');
  assert.equal(ctx.company, 'Swiggy');
  assert.equal(ctx.location, 'Bangalore');
  assert.match(ctx.description, /Optimize recommendation algorithms/);
});

test('Non-job page triggers NO_JOB_DESCRIPTION_FOUND warning', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>About Us</h1>
        <p>Short page without any job content.</p>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://example.com/about' });
  const ctx = extractJobContextFromDocument(dom.window.document, dom.window);

  assert.ok(ctx.warnings.includes('NO_JOB_DESCRIPTION_FOUND'));
});
