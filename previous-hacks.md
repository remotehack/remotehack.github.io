---
layout: default
title: Previous hacks
---

# Previous hacks

This started out as an idea for just one random day, but we've since decided to keep doing it on the last Saturday of every month.

Here are links to write-ups of our previous hack days!

<ol class="past-events">
  {% assign sorted_hacks = site.hacks | where:"happened",true | sort:"date" | reverse %}
  {% for hack in sorted_hacks %}
    <li>
      <a href="{{ hack.url }}">
        {{hack.date | date: '%B %Y' }}
        {% if hack.event_name %}
        - {{hack.event_name}}
        {% endif %}
      </a>
    </li>
  {% endfor %}
</ol>