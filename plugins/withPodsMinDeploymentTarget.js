// Xcode 27 rejects pod targets whose iOS deployment target is below 15.0
// (e.g. SDWebImage's and react-native-svg's resource bundles still declare
// 9.0 / 12.4). This raises any lower per-pod target to the app's minimum in
// the Podfile's post_install, so it survives `expo prebuild`.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MIN_IOS = '15.1';
const MARKER = '# withPodsMinDeploymentTarget';

module.exports = function withPodsMinDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes(MARKER)) {
        contents = contents.replace(
          /post_install do \|installer\|\n/,
          (m) =>
            `${m}    ${MARKER}\n` +
            `    installer.pods_project.targets.each do |t|\n` +
            `      t.build_configurations.each do |c|\n` +
            `        current = c.build_settings['IPHONEOS_DEPLOYMENT_TARGET']\n` +
            `        if current.nil? || Gem::Version.new(current) < Gem::Version.new('${MIN_IOS}')\n` +
            `          c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'\n` +
            `        end\n` +
            `      end\n` +
            `    end\n`,
        );
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
