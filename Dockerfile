FROM jekyll/jekyll:3.8

COPY ./Gemfile /srv/jekyll

RUN jekyll build

EXPOSE 4000

ENTRYPOINT ["jekyll", "serve"]
