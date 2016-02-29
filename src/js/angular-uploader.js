(function () {
    'use strict';

    angular.module('angularUploader', ['session', 'ngDialog', 'angularStringFilters', 'angularThumb', 'angularAudio', 'angularSimpleUploader', 'cfp.loadingBar'])
        .factory('$musicUploader', ['ngDialog', '$timeout', function ($dialog, $timeout) {
            var audioUploader = {};
            var baseURL = '/bgtracks';

            audioUploader.show = function (cb, sound, hideTunes, hideSfx, defaultTab) {
                $dialog.open({
                    template: '/static/bower_components/angular-uploader/src/templates/audio-popup.html',
                    className: 'ngdialog-theme-plain',
                    controller: ['$scope', function ($scope) {
                        $scope.obj = {};
                        $scope.obj.sound = sound || '';
                        $scope.hideTunes = !!hideTunes;
                        $scope.hideSfx = !!hideSfx;

                        $scope.init = function () {
                            $.getJSON(baseURL + '/sfxs?sort=genre' + '&callback=?', function (obj) {
                                //console.log(obj);
                                $timeout(function () { $scope.sfxs = obj; });
                            });

                            $.getJSON(baseURL + '/tracks?sort=genre' + '&callback=?', function (obj) {
                                //console.log(obj);
                                $timeout(function () { $scope.tracks = obj; });
                            });

                            $.getJSON(baseURL + '/resources?sort=popularity&callback=?', function (obj) {
                                $timeout(function () { $scope.resources = obj; });
                            });

                            if (defaultTab) {
                                $timeout(function () { $('a[href="#' + defaultTab + '"').click(); }, 500);
                            }
                        };

                        $scope.absoluteURL = function (u) {
                            return /^http/i.test(u) ? u : baseURL + u;
                        };

                        $scope.save = function () {
                            $timeout(function () { cb($scope.obj.sound || null); });
                            $scope.closeThisDialog();
                        };

                        $scope.init();
                    }]
                });
            };

            return audioUploader;
        }])
        .factory('$mediaUploader', ['ngDialog', '$timeout', '$notice', '$q', '$http', 'cfpLoadingBar', function ($dialog, $timeout, $notice, $q, $http, cfpLoadingBar) {
            var mediaUploader = {};

            mediaUploader.show = function (args) {
                var promises = [];

                $dialog.open({
                    template: '/static/bower_components/angular-uploader/src/templates/media-popup.html',
                    className: 'ngdialog-theme-plain custom-width',
                    controller: ['$scope', function ($scope) {
                        $scope.cb = args.cb;
                        $scope.tab = args.activeTab;
                        $scope.term = args.term || '';
                        $scope.singular = args.singular;
                        $scope.withCaptions = args.withCaptions;
                        $scope.tabs = args.tabs || {'image-search': true, 'video-search': true, 'upload': true};
                        $scope.license = args.license || 'any';
                        $scope.autoSearch = args.autoSearch;

                        $scope.imageResults = [];
                        $scope.sources = {};
                        $scope.urls = [];

                        $scope.init = function () {
                            $scope.$watch('sources', function () {
                                $scope.urls.splice(0, $scope.urls.length);

                                angular.forEach($scope.sources, function (v, k) {
                                    if (v) {
                                        $scope.urls.push(k);
                                    }
                                });
                            }, true);

                            $timeout(function () {
                                $('a[data-toggle="tab"]').click($scope.onTabSwitch);
                                $('a[href="#' + ($scope.tab || 'image-search') + '"').click();
                            }, 500);
                        };

                        $scope.onTabSwitch = function () {
                            if ($scope.term && $scope.autoSearch) {
                                $timeout(function () {
                                    if ($('div.tab-pane.active div.image-result').length == 0) {
                                        $('div.tab-pane.active button.btn-go').click();
                                    }
                                }, 500);
                            }
                        };

                        $scope.upload = function (uploads) {
                            if ($scope.singular) {
                                $scope.urls[0] = uploads;
                            } else {
                                angular.forEach(uploads, function (url) {
                                    $scope.urls.push(url);
                                });
                            }
                        };

                        $scope.searchImages = function (term) {
                            cfpLoadingBar.start();
                            $scope.imageResults.splice(0, $scope.imageResults.length);
                            $scope.searching = true;

                            $http.get('/image-search', {params: {term: term, license: $scope.license}}).then(function (obj) {
                                if (obj && obj.data && obj.data.results && obj.data.results.length > 0) {
                                    angular.forEach(obj.data.results, function (result) {
                                        $scope.imageResults.push({thumb: result.thumb || result.src, src: result.src, caption: result.caption || $scope.basename(result)});
                                    });
                                }
                            }, $notice.defaultError).then(function () {$scope.searching = false;})
                        };

                        $scope.basename = function (url) {
                            return (url || '').split('/').pop();
                        };

                        $scope.loadVideos = function (term) {
                            if (typeof(window.videoSearch) !== 'undefined') {
                                $scope.searchVideos(term);
                            } else {
                                if (typeof(gapi) !== 'undefined') {
                                    gapi.client.load('youtube', 'v3', function () {window.videoSearch = gapi.client.youtube.search.list;});
                                }
                                setTimeout($scope.loadVideos, 1000, term);
                            }
                        };

                        $scope.searchVideos = function (term, token) {
                            $scope.moreVideos = false;

                            var api_key = 'AIzaSyCBdyG0mb-kaxrHkY3bH3LmPGqigFrEtVg ';
                            var params = {key: api_key, type: 'video', q: term, part: 'snippet', videoLicense: $scope.license || 'any', videoEmbeddable: true, maxResults: 24};

                            if (token) {
                                params['pageToken'] = token;
                            } else {
                                $scope.videoResults = [];
                            }

                            var request = window.videoSearch(params);

                            request.execute(function (response) {
                                cfpLoadingBar.complete();

                                angular.forEach(response.items, function (result) {
                                    $scope.videoResults.push({
                                        thumb: result.snippet.thumbnails.default.url,
                                        src: 'http://www.youtube.com/watch?v=' + result.id.videoId,
                                        caption: result.snippet.title
                                    });
                                });

                                $timeout(function () {$scope.moreVideos = response.nextPageToken ? response.nextPageToken : false;});
                            });

                            cfpLoadingBar.start();
                        };

                        $scope.add = function (url) {
                            if ($scope.singular) {
                                $scope.urls[0] = url;
                            } else {
                                $scope.sources[url] = !$scope.sources[url];
                            }
                        };

                        $scope.sel = function (url) {
                            return ($scope.singular && (url === $scope.urls[0])) || $scope.sources[url];
                        };

                        $scope.itemType = function (url) {
                            return (/youtube\.com/i.test(url) || /(\.mp4)$/.test(url)) ? 'video' : 'photo';
                        };

                        $scope.save = function () {
                            if (($scope.urls.length > 0) && ($scope.cb instanceof Function)) {
                                var proxy = [];
                                for (var i = $scope.urls.length - 1; i >= 0; i--) {
                                    var url = $scope.urls[i];
                                    if (($scope.itemType(url) === 'photo') && !/s3\.amazonaws\.com/i.test(url) && !/cloudfront\.net/i.test(url)) {
                                        proxy.push(url);
                                        $scope.urls.splice(i, 1);
                                    }
                                }

                                if (proxy.length > 0) {
                                    $scope.processing = true;

                                    $http.post('/generic/url-proxy', {urls: proxy}).then(
                                        function success(obj) {
                                            if ($scope.processing) {
                                                var urls = obj.data;
                                                if (urls && urls.length > 0) {
                                                    angular.forEach(urls, function (url) {
                                                        if (url && url.copy) {
                                                            $scope.urls.push(url.copy);
                                                            angular.extend(_.findWhere($scope.imageResults, {src: url.src}) || {}, {src: url.copy});
                                                        }
                                                    });
                                                }

                                                $scope.addURLs();
                                            }
                                        },
                                        $scope.addURLs
                                    );
                                } else {
                                    $scope.addURLs();
                                }
                            } else {
                                $scope.closeThisDialog();
                            }
                        };

                        $scope.abort = function () {
                            $scope.processing = false;
                        };

                        $scope.removeThumb = function (item) {
                            if ($scope.imageResults) {
                                var index = $scope.imageResults.indexOf(item);
                                if (index != -1) {
                                    $timeout(function () {$scope.imageResults.splice(index, 1);});
                                } else {
                                    //console.log("item not found: ", item);
                                }
                            }
                        };

                        $scope.addURLs = function () {
                            var urls = $scope.urls;
                            var results = [];

                            if ($scope.withCaptions) {
                                angular.forEach(urls, function (url) {
                                    results.push(_.findWhere($scope.videoResults, {src: url}) || _.findWhere($scope.imageResults, {src: url}) || {src: url});
                                });
                            } else {
                                results = results.concat(urls);
                            }

                            $timeout(function () { $scope.cb(results ? ($scope.singular ? results[0] : results) : []); });
                            $scope.closeThisDialog();
                        };

                        $scope.init();
                    }]
                });
            };

            return mediaUploader;
        }])
        .directive('sfxButton', ['$musicUploader', function ($musicUploader) {
            return {
                restrict: 'A',
                require: 'ngModel',
                scope: {},
                link: function ($scope, element, attrs, ngModel) {
                    element.click(function () {
                        $musicUploader.show(function save(url) {
                            ngModel.$setViewValue(url);
                        }, ngModel.$viewValue, true, false);
                    });
                }
            }
        }])
        .directive('musicButton', ['$musicUploader', function ($musicUploader) {
            return {
                restrict: 'A',
                require: 'ngModel',
                scope: {},
                link: function ($scope, element, attrs, ngModel) {
                    element.click(function () {
                        $musicUploader.show(function save(url) {
                            ngModel.$setViewValue(url);
                        }, ngModel.$viewValue, false, true);
                    });
                }
            }
        }])
})();


