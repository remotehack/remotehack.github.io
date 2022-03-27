# remotehack.space

## local development

```
$ bundle install
$ bundle exec jekyll serve --watch
```

## local development (gitpod version)

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/remotehack/remotehack.github.io/)

## local development (docker version)

```bash
docker build -t NAME_OF_IMAGE_HERE .
```

then

```bash
docker run --rm -it -v $(pwd):/srv/jekyll -p 4000:4000 NAME_OF_IMAGE_HERE
```

## troubleshooting

If you're installing and running things locally, you will probably encounter errors installing nokogiri. When this happens, follow the instructions [here](https://github.com/sparklemotion/nokogiri.org/blob/91e624fa8d6c918d7905954fd8da7ea40f237d88/docs/tutorials/installing_nokogiri.md)
